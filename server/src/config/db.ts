import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { env } from './env';
import * as schema from '../db/schema';

const client = postgres(env.DATABASE_URL, {
  max: 5,
  idle_timeout: 60,
  max_lifetime: 60 * 30,
});

export const db = drizzle(client, { schema });
export type Database = typeof db;
