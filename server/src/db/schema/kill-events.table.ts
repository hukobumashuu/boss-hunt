import {
  pgTable,
  serial,
  integer,
  timestamp,
  index,
  uniqueIndex,
  uuid,
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

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    requestId: uuid('request_id'),
  },
  (table) => [
    index('boss_channel_idx').on(table.bossId, table.channel),
    uniqueIndex('kill_logger_request_idx').on(table.loggerId, table.requestId),
  ],
);

export type KillEvent = InferSelectModel<typeof killEvents>;
export type NewKillEvent = InferInsertModel<typeof killEvents>;
