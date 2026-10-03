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
    const boss = await this.repo.findBossById(input.bossId);
    if (!boss) {
      throw new NotFoundError(`Boss ${input.bossId} does not exist`);
    }

    if (!input.force) {
      const latest = await this.repo.findLatestKill(
        input.bossId,
        input.channel,
      );
      if (latest) {
        const latestReset = await this.resetRepo.findLatest();
        const baseline = effectiveLastKilledAt(
          latest.killedAt,
          boss.respawnIntervalHours,
          latestReset?.resetAt ?? null,
        );
        const window = computeWindowState(
          baseline,
          boss.respawnIntervalHours,
          now,
        );
        const firstBoundaryAt = new Date(
          baseline.getTime() + boss.respawnIntervalHours * 60 * 60 * 1000,
        );
        if (now < firstBoundaryAt) {
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
    }

    const inserted = await this.repo.insertKill({
      bossId: input.bossId,
      channel: input.channel,
      loggerId: logger.id,
    });

    return { ...inserted, loggedByName: logger.name };
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

    const ageMs = now.getTime() - kill.killedAt.getTime();
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
