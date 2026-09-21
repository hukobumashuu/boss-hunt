import { desc, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../config/db';
import { killEvents, bosses } from '../../db/schema';

export interface LatestKillRow {
  bossId: number;
  bossName: string;
  map: string;
  respawnIntervalHours: number;
  channel: number;
  lastKilledAt: Date;
}

export class TrackerRepository {
  constructor(private readonly db: Database) {}

  /**
   * One row per (boss, channel) pair that has at least one non-voided
   * kill logged, containing only the most recent such kill for that
   * pair. Voided rows are excluded here, not deleted from the table -
   * if a channel's only kill gets voided, it just drops back out of the
   * tracker, same as if it had never been logged. At the current scale
   * (<=150 boss+channel combinations) this is cheap even without the
   * DISTINCT ON - the index on (boss_id, channel) keeps it fast as
   * history grows.
   */
  async findLatestKillPerBossChannel(): Promise<LatestKillRow[]> {
    return this.db
      .selectDistinctOn([killEvents.bossId, killEvents.channel], {
        bossId: killEvents.bossId,
        channel: killEvents.channel,
        lastKilledAt: killEvents.killedAt,
        bossName: bosses.name,
        map: bosses.map,
        respawnIntervalHours: bosses.respawnIntervalHours,
      })
      .from(killEvents)
      .innerJoin(bosses, eq(killEvents.bossId, bosses.id))
      .where(isNull(killEvents.voidedAt))
      .orderBy(
        killEvents.bossId,
        killEvents.channel,
        desc(killEvents.killedAt),
      );
  }
}
