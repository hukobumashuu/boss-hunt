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
  console.log(`  new bookmark: ${env.ALLOWED_ORIGIN}/#token=${token}`);
  console.log('  their old link no longer works.');
  process.exit(0);
}

rotateToken().catch((err: unknown) => {
  console.error('Token rotation failed:', err);
  process.exit(1);
});
