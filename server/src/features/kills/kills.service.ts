import type { KillRepository } from './kills.repository';
import type { ResetRepository } from '../resets/resets.repository';
import type { LogKillBody } from './kills.types';
import {
  NotFoundError,
  DuplicateKillWarning,
  ForbiddenError,
  VoidNotAllowedError,
} from '../../shared/utils/app-error';
import { VOID_WINDOW_MS } from '../../shared/utils/constants';
import {
  computeWindowState,
  effectiveLastKilledAt,
  STALE_MISSED_THRESHOLD,
} from '../tracker/tracker.derivation';
import type { KillEvent } from '../../db/schema';

function formatTime(d: Date): string {
  return d.toLocaleTimeString('en-PH', {
    timeZone: 'Asia/Manila',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export interface AuthenticatedLogger {
  id: number;
  name: string;
}

export interface LoggedKill extends KillEvent {
  loggedByName: string;
}

export class KillService {
  constructor(
    private readonly repo: KillRepository,
    private readonly resetRepo: ResetRepository,
  ) {}

  async logKill(
    input: LogKillBody,
    logger: AuthenticatedLogger,
    now: Date = new Date(),
  ): Promise<LoggedKill> {
    // A retried request whose first attempt actually reached the database must
    // return that kill, not trip the duplicate guard against its own row.
    const replay = await this.findReplay(input, logger);
    if (replay) return replay;

    const boss = await this.repo.findBossById(input.bossId);
    if (!boss) {
      throw new NotFoundError(`Boss ${input.bossId} does not exist`);
    }

    // The moment the kill happened, not the moment this request arrived.
    const killedAt = new Date(now.getTime() - (input.killedAgoMs ?? 0));

    if (!input.force) {
      try {
        await this.assertNotDuplicate(
          input,
          boss.respawnIntervalHours,
          killedAt,
        );
      } catch (err) {
        // A retry can overlap its own original: by the time this guard runs
        // the original may have just stored the kill, which would look like
        // someone else's duplicate. The same key means the same kill.
        if (err instanceof DuplicateKillWarning) {
          const raced = await this.findReplay(input, logger);
          if (raced) return raced;
        }
        throw err;
      }
    }

    const inserted = await this.repo.insertKill({
      bossId: input.bossId,
      channel: input.channel,
      loggerId: logger.id,
      killedAt,
      ...(input.requestId !== undefined ? { requestId: input.requestId } : {}),
    });

    return { ...inserted, loggedByName: logger.name };
  }

  private async findReplay(
    input: LogKillBody,
    logger: AuthenticatedLogger,
  ): Promise<LoggedKill | null> {
    if (input.requestId === undefined) return null;
    const existing = await this.repo.findKillByRequestId(
      logger.id,
      input.requestId,
    );
    return existing ? { ...existing, loggedByName: logger.name } : null;
  }

  private async assertNotDuplicate(
    input: LogKillBody,
    respawnIntervalHours: number,
    killedAt: Date,
  ): Promise<void> {
    const latest = await this.repo.findLatestKill(input.bossId, input.channel);
    if (!latest) return;

    const latestReset = await this.resetRepo.findLatest();
    const baseline = effectiveLastKilledAt(
      latest.killedAt,
      respawnIntervalHours,
      latestReset?.resetAt ?? null,
    );
    const window = computeWindowState(baseline, respawnIntervalHours, killedAt);
    const firstBoundaryAt = new Date(
      baseline.getTime() + respawnIntervalHours * 60 * 60 * 1000,
    );
    if (killedAt < firstBoundaryAt) {
      throw new DuplicateKillWarning(
        `${latest.loggerName} already logged Ch ${input.channel} - ` +
          `not due until ${formatTime(window.nextWindowAt)}. Log anyway?`,
        latest.loggerName,
        latest.killedAt,
      );
    }
    if (window.windowsElapsed >= STALE_MISSED_THRESHOLD) {
      throw new DuplicateKillWarning(
        `Ch ${input.channel} hasn't been confirmed in ` +
          `${window.windowsElapsed} cycles - might not be ours ` +
          `anymore. Log anyway?`,
        latest.loggerName,
        latest.killedAt,
      );
    }
  }

  async voidKill(
    killId: number,
    logger: AuthenticatedLogger,
    now: Date = new Date(),
  ): Promise<void> {
    const kill = await this.repo.findKillById(killId);
    if (!kill || kill.voidedAt) {
      throw new NotFoundError(`Kill ${killId} not found`);
    }

    if (kill.loggerId !== logger.id) {
      throw new ForbiddenError('You can only void a kill you logged yourself');
    }

    // Measured from when the log was received, not from the (possibly
    // back-dated) kill time, so undoing a late-confirmed kill still works.
    const ageMs = now.getTime() - kill.createdAt.getTime();
    if (ageMs > VOID_WINDOW_MS) {
      throw new VoidNotAllowedError('This was logged too long ago to void');
    }

    const latest = await this.repo.findLatestKill(kill.bossId, kill.channel);
    if (latest?.id !== kill.id) {
      throw new VoidNotAllowedError(
        'A newer kill has already been logged for this channel - voiding this one would rewrite what happened after it',
      );
    }

    await this.repo.voidKillById(killId, now);
  }
}
