import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from './env';
import * as schema from '../db/schema';

const client = postgres(env.DATABASE_URL, {
  max: 5,
  // Fail fast instead of queueing behind a connection that never opens.
  connect_timeout: 10,
  idle_timeout: 60,
  max_lifetime: 60 * 30,
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
