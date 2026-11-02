import { createApp } from './app';
import { env } from './config/env';
import {
  describeDatabaseTarget,
  evaluateServerStartup,
  formatTarget,
} from './config/db-target';

function start(): void {
  const target = describeDatabaseTarget(env.DATABASE_URL);
  const startup = evaluateServerStartup({
    nodeEnv: env.NODE_ENV,
    target,
    allowRemoteDb: env.ALLOW_REMOTE_DB,
  });
  if (!startup.allowed) {
    console.error(startup.reason);
    process.exit(1);
  }

  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(`boss-tracker API listening on :${env.PORT}`);
    console.log(`  environment: ${env.NODE_ENV}`);
    console.log(`  CORS origin: ${env.ALLOWED_ORIGIN}`);
    console.log(
      `  database:    ${formatTarget(target)} (${target.isLocal ? 'local' : 'REMOTE'})`,
    );
    if (!target.isLocal && env.NODE_ENV !== 'production') {
      console.warn(
        '  WARNING: this non-production server is using a REMOTE database ' +
          '(ALLOW_REMOTE_DB=true).',
      );
    }
  });
}

try {
  start();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
