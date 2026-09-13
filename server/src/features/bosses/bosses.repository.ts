import type { Database } from '../../config/db';
import { bosses } from '../../db/schema';
import type { Boss } from '../../db/schema';

export class BossRepository {
  constructor(private readonly db: Database) {}

  async findAll(): Promise<Boss[]> {
    return this.db.select().from(bosses);
  }
}
