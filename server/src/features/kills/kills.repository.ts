import { and, desc, eq, gte } from 'drizzle-orm';
import type { Database } from '../../config/db';
import { killEvents, bosses, loggers } from '../../db/schema';
import type { KillEvent } from '../../db/schema';

export interface RecentKill {
  killedAt: Date;
  loggerName: string;
}

export class KillRepository {
  constructor(private readonly db: Database) {}

  async findBossById(bossId: number) {
    const [boss] = await this.db
      .select()
      .from(bosses)
      .where(eq(bosses.id, bossId))
      .limit(1);
    return boss ?? null;
  }

  /** Most recent kill for this boss+channel logged within `sinceMs` of now,
   * joined to the logger's name for the duplicate-warning message. */
  async findRecentKill(
    bossId: number,
    channel: number,
    sinceMs: number,
  ): Promise<RecentKill | null> {
    const cutoff = new Date(Date.now() - sinceMs);
    const [recent] = await this.db
      .select({ killedAt: killEvents.killedAt, loggerName: loggers.name })
      .from(killEvents)
      .innerJoin(loggers, eq(killEvents.loggerId, loggers.id))
      .where(
        and(
          eq(killEvents.bossId, bossId),
          eq(killEvents.channel, channel),
          gte(killEvents.killedAt, cutoff),
        ),
      )
      .orderBy(desc(killEvents.killedAt))
      .limit(1);
    return recent ?? null;
  }

  /** Insert a kill. Server sets killedAt via DB default(now()); loggerId
   * comes from the authenticated request, never from the request body. */
  async insertKill(input: {
    bossId: number;
    channel: number;
    loggerId: number;
  }): Promise<KillEvent> {
    const [inserted] = await this.db
      .insert(killEvents)
      .values(input)
      .returning();

    if (!inserted) {
      throw new Error('Insert did not return a row');
    }
    return inserted;
  }
}
