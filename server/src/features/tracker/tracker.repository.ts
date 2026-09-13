import { desc, eq } from 'drizzle-orm';
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
   * One row per (boss, channel) pair that has ever had a kill logged,
   * containing only the most recent kill for that pair. At the current
   * scale (<=150 boss+channel combinations) this is cheap even without
   * the DISTINCT ON - the index on (boss_id, channel) keeps it fast as
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
      .orderBy(
        killEvents.bossId,
        killEvents.channel,
        desc(killEvents.killedAt),
      );
  }
}
