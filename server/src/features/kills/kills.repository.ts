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

  async findKillByRequestId(
    loggerId: number,
    requestId: string,
  ): Promise<KillEvent | null> {
    const [kill] = await this.db
      .select()
      .from(killEvents)
      .where(
        and(
          eq(killEvents.loggerId, loggerId),
          eq(killEvents.requestId, requestId),
        ),
      )
      .limit(1);
    return kill ?? null;
  }

  /**
   * Inserts a kill. When a requestId is supplied the insert is idempotent: if
   * this logger already stored a kill under that key (including a concurrent
   * duplicate request racing this one), the existing row is returned instead
   * of creating a second kill.
   */
  async insertKill(input: {
    bossId: number;
    channel: number;
    loggerId: number;
    killedAt: Date;
    requestId?: string;
  }): Promise<KillEvent> {
    const [inserted] = await this.db
      .insert(killEvents)
      .values(input)
      .onConflictDoNothing({
        target: [killEvents.loggerId, killEvents.requestId],
      })
      .returning();

    if (inserted) {
      return inserted;
    }

    if (input.requestId !== undefined) {
      const existing = await this.findKillByRequestId(
        input.loggerId,
        input.requestId,
      );
      if (existing) {
        return existing;
      }
    }
    throw new Error('Insert did not return a row');
  }

  async voidKillById(id: number, now: Date): Promise<KillEvent | null> {
    const [voided] = await this.db
      .update(killEvents)
      .set({ voidedAt: now })
      .where(and(eq(killEvents.id, id), isNull(killEvents.voidedAt)))
      .returning();
    return voided ?? null;
  }
}
