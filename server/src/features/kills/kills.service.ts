import type { KillRepository } from './kills.repository';
import type { LogKillBody } from './kills.types';
import {
  NotFoundError,
  DuplicateKillWarning,
  ForbiddenError,
  VoidNotAllowedError,
} from '../../shared/utils/app-error';
import { VOID_WINDOW_MS } from '../../shared/utils/constants';
import { computeWindowState } from '../tracker/tracker.derivation';
import type { KillEvent } from '../../db/schema';

export interface AuthenticatedLogger {
  id: number;
  name: string;
}

export interface LoggedKill extends KillEvent {
  loggedByName: string;
}

export class KillService {
  constructor(private readonly repo: KillRepository) {}

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
      // A prior kill only blocks a new one while its own window hasn't
      // opened - the same math the tracker uses to color a row, run here
      // before the insert instead of after. This replaces a raw "was
      // something logged in the last 2 minutes" lookback: that caught
      // two people double-tapping the same kill, but had no idea whether
      // the channel was actually due, so a kill logged 3 hours into a
      // 4-hour window sailed straight through it. A fresh double-tap is
      // still caught here for free - the first tap makes the channel
      // `locked` again immediately, so the second tap lands right back
      // in this same branch.
      if (latest) {
        const window = computeWindowState(
          latest.killedAt,
          boss.respawnIntervalHours,
          now,
        );
        if (window.status !== 'open') {
          throw new DuplicateKillWarning(
            `${latest.loggerName} already logged Ch ${input.channel} - ` +
              `not due until ${window.nextWindowAt.toISOString()}. Log anyway?`,
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

    // The controller already knows the logger's name from auth - no need
    // for a second query just to echo it back in the response.
    return { ...inserted, loggedByName: logger.name };
  }

  /**
   * Void a mistaken kill log. Deliberately narrow: only the logger who
   * created it, only within VOID_WINDOW_MS of logging it, and only if no
   * newer kill has been logged for the same boss+channel since (voiding
   * it at that point would rewrite what happened after it, not just
   * correct a typo). Marks `voidedAt`; the row and everything on it stay
   * exactly as originally written.
   */
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
