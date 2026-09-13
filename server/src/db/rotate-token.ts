import { randomBytes, createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { loggers } from './schema';
import { env } from '../config/env';

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Usage: bun src/db/rotate-token.ts "Player1"
 *
 * Invalidates that person's old token immediately (the row's tokenHash
 * changes, so the old plaintext token no longer matches anything) and
 * prints a fresh bookmark link. This is the actual fix for "a token
 * leaked" - not a timer, an on-demand rotation of the one credential
 * that's compromised.
 */
async function rotateToken() {
  const name = process.argv[2];
  if (!name) {
    console.error('Usage: bun src/db/rotate-token.ts "PersonName"');
    process.exit(1);
  }

  const token = generateToken();
  const tokenHash = hashToken(token);

  const [updated] = await db
    .update(loggers)
    .set({ tokenHash })
    .where(eq(loggers.name, name))
    .returning();

  if (!updated) {
    console.error(`No logger named "${name}" found - check the spelling.`);
    process.exit(1);
  }

  console.log(`\nRotated token for ${name}`);
  console.log(`  new bookmark: ${env.ALLOWED_ORIGIN}/?token=${token}`);
  console.log('  their old link no longer works.');
  process.exit(0);
}

rotateToken().catch((err: unknown) => {
  console.error('Token rotation failed:', err);
  process.exit(1);
});
