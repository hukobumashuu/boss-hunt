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
 * Append-only log - single source of truth. A row's own fields
 * (bossId, channel, killedAt, loggerId) are never UPDATE'd or DELETE'd
 * once written; `voidedAt` is the one exception, and it's additive, not
 * corrective - it marks a row as not counting, it doesn't change what
 * the row says happened. Everything else (next window, elapsed windows,
 * future stats) is derived from this table, not stored.
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
    // Null = counts. Set once, by the same logger, within a short window
    // after logging (see VOID_WINDOW_MS) - a correction mechanism for
    // "wrong boss/channel", not a second way to edit or delete a row.
    // The row itself is never touched otherwise - still append-only.
    voidedAt: timestamp('voided_at', { withTimezone: true }),
  },
  (table) => [index('boss_channel_idx').on(table.bossId, table.channel)],
);

export type KillEvent = InferSelectModel<typeof killEvents>;
export type NewKillEvent = InferInsertModel<typeof killEvents>;
