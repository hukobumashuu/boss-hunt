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
