import { randomBytes, createHash } from 'node:crypto';
import { db } from '../config/db';
import { loggers } from './schema';
import { KNOWN_LOGGERS } from '../shared/utils/constants';
import { env } from '../config/env';

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Run once per person (or once for everyone in KNOWN_LOGGERS, at setup
 * time). Safe to re-run: `onConflictDoNothing({ target: loggers.name })`
 * lets Postgres itself decide whether the insert happened, so an
 * already-existing name is skipped without ever needing to inspect a
 * driver error's shape - `.returning()` simply comes back empty for a
 * row that was skipped, which is a stable, documented Postgres/Drizzle
 * behavior rather than something tied to how a specific driver version
 * happens to format its errors.
 *
 * Prints the plaintext token exactly once per newly-created person -
 * it's stored hashed, so this is the only time it's ever recoverable.
 * If someone's token leaks, don't try to "expire" it: use
 * `db:rotate-token` for just their name, which invalidates the old one
 * immediately.
 */
async function generateTokens() {
  for (const name of KNOWN_LOGGERS) {
    const token = generateToken();
    const tokenHash = hashToken(token);

    const inserted = await db
      .insert(loggers)
      .values({ name, tokenHash })
      .onConflictDoNothing({ target: loggers.name })
      .returning({ id: loggers.id });

    if (inserted.length === 0) {
      console.log(
        `\n${name} already exists - skipped. Run ` +
          `\`bun run db:rotate-token "${name}"\` if you need a new ` +
          `token for them.`,
      );
      continue;
    }

    const bookmarkUrl = `${env.ALLOWED_ORIGIN}/?token=${token}`;
    console.log(`\n${name}`);
    console.log(`  token:    ${token}`);
    console.log(`  bookmark: ${bookmarkUrl}`);
  }
  console.log(
    '\nSend each person their own bookmark link. The frontend reads the ' +
      'token from the URL once, saves it, and never shows it in the ' +
      'address bar again.',
  );
  process.exit(0);
}

generateTokens().catch((err: unknown) => {
  console.error('Token generation failed:', err);
  process.exit(1);
});
