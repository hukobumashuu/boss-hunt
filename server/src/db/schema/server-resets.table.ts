import { pgTable, serial, timestamp, integer } from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { loggers } from './loggers.table';

export const serverResets = pgTable('server_resets', {
  id: serial('id').primaryKey(),
  resetAt: timestamp('reset_at', { withTimezone: true }).notNull().defaultNow(),
  loggerId: integer('logger_id')
    .notNull()
    .references(() => loggers.id),
});

export type ServerReset = InferSelectModel<typeof serverResets>;
export type NewServerReset = InferInsertModel<typeof serverResets>;
