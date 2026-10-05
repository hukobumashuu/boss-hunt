import {
  pgTable,
  serial,
  integer,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { bosses } from './bosses.table';
import { loggers } from './loggers.table';

export const killEvents = pgTable(
  'kill_events',
  {
    id: serial('id').primaryKey(),
    bossId: integer('boss_id')
      .notNull()
      .references(() => bosses.id),
    channel: integer('channel').notNull(),
    killedAt: timestamp('killed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    loggerId: integer('logger_id')
      .notNull()
      .references(() => loggers.id),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
  },
  (table) => [index('boss_channel_idx').on(table.bossId, table.channel)],
);

export type KillEvent = InferSelectModel<typeof killEvents>;
export type NewKillEvent = InferInsertModel<typeof killEvents>;
