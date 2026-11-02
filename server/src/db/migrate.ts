import { join } from 'node:path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { enforceTarget, parseCliArgs } from './target-guard';

const MIGRATIONS_FOLDER = join(import.meta.dir, 'migrations');

async function countApplied(client: postgres.Sql): Promise<number> {
  try {
    const rows = await client<
      { n: number }[]
    >`select count(*)::int as n from drizzle.__drizzle_migrations`;
    return rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

async function main(): Promise<void> {
  const { production, allowDeploy } = parseCliArgs(process.argv.slice(2));
  enforceTarget(production ? 'production' : 'dev', {
    action: process.env['npm_lifecycle_event'] ?? 'migrate',
    allowDeploy,
  });

  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL is not set.');
  }

  const client = postgres(url, {
    max: 1,
    connect_timeout: 10,
    onnotice: () => {},
  });
  try {
    const before = await countApplied(client);
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
    const after = await countApplied(client);
    console.log(
      `Migrations applied successfully: ${after - before} new, ${after} total.`,
    );
  } finally {
    await client.end({ timeout: 5 });
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
