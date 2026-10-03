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

    const bookmarkUrl = `${env.ALLOWED_ORIGIN}/#token=${token}`;
    console.log(`\n${name}`);
    console.log(`  token:    ${token}`);
    console.log(`  bookmark: ${bookmarkUrl}`);
  }
  console.log(
    '\nSend each person their own bookmark link. The frontend reads the ' +
      'fragment token once and saves it locally.',
  );
  process.exit(0);
}

generateTokens().catch((err: unknown) => {
  console.error('Token generation failed:', err);
  process.exit(1);
});
