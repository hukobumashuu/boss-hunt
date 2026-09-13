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

/**
 * Append-only log - single source of truth. Never UPDATE or DELETE rows;
 * everything else (next window, elapsed windows, future stats) is derived
 * from this table, not stored.
 */
export const killEvents = pgTable(
  'kill_events',
  {
    id: serial('id').primaryKey(),
    bossId: integer('boss_id')
      .notNull()
      .references(() => bosses.id),
    channel: integer('channel').notNull(),
    // Server-set, never trust a client-sent timestamp.
    killedAt: timestamp('killed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Derived from the authenticated request, never from the request body.
    loggerId: integer('logger_id')
      .notNull()
      .references(() => loggers.id),
  },
  (table) => [index('boss_channel_idx').on(table.bossId, table.channel)],
);

export type KillEvent = InferSelectModel<typeof killEvents>;
export type NewKillEvent = InferInsertModel<typeof killEvents>;
