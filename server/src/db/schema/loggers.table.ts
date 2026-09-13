import { pgTable, serial, varchar, timestamp } from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

/**
 * One row per guildmate. `tokenHash` is a SHA-256 hex digest of their API
 * token - the plaintext token is shown once at generation time (see
 * db/generate-token.ts) and never stored. A random 32-byte token already
 * has enough entropy that a fast hash is fine here; this isn't a
 * human-chosen password that needs bcrypt-style slow hashing.
 */
export const loggers = pgTable('loggers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Logger = InferSelectModel<typeof loggers>;
export type NewLogger = InferInsertModel<typeof loggers>;
