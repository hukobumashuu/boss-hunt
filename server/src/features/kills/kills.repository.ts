import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Database } from '../../config/db';
import { killEvents, bosses, loggers } from '../../db/schema';
import type { KillEvent } from '../../db/schema';

export interface LatestKillInfo {
  id: number;
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

  /** Most recent non-voided kill for this boss+channel, joined to the
   * logger's name for the "not due yet" warning. No time lookback - the
   * caller runs this through computeWindowState (the same math the
   * tracker uses) to decide whether it's actually due, instead of a
   * fixed cutoff that has no idea what "due" means. */
  async findLatestKill(
    bossId: number,
    channel: number,
  ): Promise<LatestKillInfo | null> {
    const [latest] = await this.db
      .select({
        id: killEvents.id,
        killedAt: killEvents.killedAt,
        loggerName: loggers.name,
      })
      .from(killEvents)
      .innerJoin(loggers, eq(killEvents.loggerId, loggers.id))
      .where(
        and(
          eq(killEvents.bossId, bossId),
          eq(killEvents.channel, channel),
          isNull(killEvents.voidedAt),
        ),
      )
      .orderBy(desc(killEvents.killedAt))
      .limit(1);
    return latest ?? null;
  }

  async findKillById(id: number): Promise<KillEvent | null> {
    const [kill] = await this.db
      .select()
      .from(killEvents)
      .where(eq(killEvents.id, id))
      .limit(1);
    return kill ?? null;
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

  /**
   * Marks a kill voided instead of deleting it - the log stays literally
   * append-only, this only adds a fact ("this entry doesn't count")
   * on top of it, it never removes one. The `voidedAt IS NULL` guard
   * makes double-voiding a no-op instead of clobbering the original
   * void timestamp.
   */
  async voidKillById(id: number, now: Date): Promise<KillEvent | null> {
    const [voided] = await this.db
      .update(killEvents)
      .set({ voidedAt: now })
      .where(and(eq(killEvents.id, id), isNull(killEvents.voidedAt)))
      .returning();
    return voided ?? null;
  }
}
