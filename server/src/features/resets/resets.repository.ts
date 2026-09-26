import { desc } from 'drizzle-orm';
import type { Database } from '../../config/db';
import { serverResets } from '../../db/schema';
import type { ServerReset } from '../../db/schema';

export class ResetRepository {
  constructor(private readonly db: Database) {}

  async findLatest(): Promise<ServerReset | null> {
    const [latest] = await this.db
      .select()
      .from(serverResets)
      .orderBy(desc(serverResets.resetAt))
      .limit(1);
    return latest ?? null;
  }

  async insert(loggerId: number): Promise<ServerReset> {
    const [inserted] = await this.db
      .insert(serverResets)
      .values({ loggerId })
      .returning();
    if (!inserted) {
      throw new Error('Insert did not return a row');
    }
    return inserted;
  }
}
