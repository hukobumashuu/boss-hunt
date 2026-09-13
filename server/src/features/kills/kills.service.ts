import type { KillRepository } from './kills.repository';
import type { LogKillBody } from './kills.types';
import {
  NotFoundError,
  DuplicateKillWarning,
} from '../../shared/utils/app-error';
import { DUPLICATE_WINDOW_MS } from '../../shared/utils/constants';
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
  ): Promise<LoggedKill> {
    const boss = await this.repo.findBossById(input.bossId);
    if (!boss) {
      throw new NotFoundError(`Boss ${input.bossId} does not exist`);
    }

    if (!input.force) {
      const recent = await this.repo.findRecentKill(
        input.bossId,
        input.channel,
        DUPLICATE_WINDOW_MS,
      );
      if (recent) {
        throw new DuplicateKillWarning(
          `${recent.loggerName} already logged this kill recently. Log anyway?`,
          recent.loggerName,
          recent.killedAt,
        );
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
}
