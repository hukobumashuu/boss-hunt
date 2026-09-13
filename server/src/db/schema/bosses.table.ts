import { pgTable, serial, varchar, integer } from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

/** Static reference data - ~5 rows, rarely changes. */
export const bosses = pgTable('bosses', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  map: varchar('map', { length: 100 }).notNull(),
  respawnIntervalHours: integer('respawn_interval_hours').notNull().default(4),
});

export type Boss = InferSelectModel<typeof bosses>;
export type NewBoss = InferInsertModel<typeof bosses>;
