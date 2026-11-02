// Describes which database a connection string points at, without ever
// exposing the credentials, and decides whether a command may touch it.

// Exact matches only: "localhost.evil.com" or "127.0.0.1.nip.io" are remote.
const LOCAL_HOSTS: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
]);

export interface DatabaseTarget {
  host: string;
  port: string;
  database: string;
  isLocal: boolean;
}

/**
 * Error messages here never include the connection string: it contains the
 * password, and these messages end up in terminals and logs.
 */
export function describeDatabaseTarget(
  connectionString: string,
): DatabaseTarget {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL.');
  }

  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error(
      'DATABASE_URL must start with postgres:// or postgresql://.',
    );
  }

  const host = url.hostname.toLowerCase();
  if (host === '') {
    throw new Error('DATABASE_URL has no host name.');
  }

  let database: string;
  try {
    database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  } catch {
    throw new Error('DATABASE_URL has an invalid database name.');
  }

  return {
    host,
    port: url.port || '5432',
    database: database || '(default)',
    isLocal: LOCAL_HOSTS.has(host),
  };
}

export function formatTarget(target: DatabaseTarget): string {
  return `${target.host}:${target.port}/${target.database}`;
}

type Env = Record<string, string | undefined>;

/** True on Render (it sets both) and anywhere NODE_ENV is production. */
export function isDeployContext(env: Env): boolean {
  return env['NODE_ENV'] === 'production' || env['RENDER'] === 'true';
}

export type TargetMode = 'dev' | 'production';

export interface TargetDecision {
  allowed: boolean;
  /** The operator must type the host name before anything runs. */
  requiresConfirmation: boolean;
  /** Why the command was refused. Only present when allowed is false. */
  reason?: string;
}

/**
 * dev commands touch local databases only. production commands touch remote
 * databases only, and only after a typed confirmation. Neither can be mistaken
 * for the other. `allowDeploy` lets an automated deploy (Render's build
 * running the migration) use a remote database without a prompt.
 */
export function evaluateTarget(input: {
  mode: TargetMode;
  target: DatabaseTarget;
  env: Env;
  allowDeploy: boolean;
}): TargetDecision {
  const { mode, target, env, allowDeploy } = input;
  const where = formatTarget(target);

  if (mode === 'dev') {
    if (target.isLocal) {
      return { allowed: true, requiresConfirmation: false };
    }
    if (allowDeploy && isDeployContext(env)) {
      return { allowed: true, requiresConfirmation: false };
    }
    return {
      allowed: false,
      requiresConfirmation: false,
      reason:
        `This is a dev command, but DATABASE_URL points at a REMOTE database (${where}). ` +
        'Dev commands only run against a local database. ' +
        'If you meant production, use the matching "db:prod:..." command.',
    };
  }

  if (target.isLocal) {
    return {
      allowed: false,
      requiresConfirmation: false,
      reason:
        `This is a production command, but DATABASE_URL points at a LOCAL database (${where}). ` +
        'Production commands read DATABASE_URL from server/.env.neon.',
    };
  }
  return { allowed: true, requiresConfirmation: true };
}

/**
 * A dev server on a laptop must not silently read and write real data. In
 * production anything goes; elsewhere a remote database needs an explicit
 * ALLOW_REMOTE_DB=true.
 */
export function evaluateServerStartup(input: {
  nodeEnv: string;
  target: DatabaseTarget;
  allowRemoteDb: boolean;
}): { allowed: boolean; reason?: string } {
  const { nodeEnv, target, allowRemoteDb } = input;
  if (nodeEnv === 'production' || target.isLocal || allowRemoteDb) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason:
      `Refusing to start: NODE_ENV is "${nodeEnv}" but DATABASE_URL points at a REMOTE ` +
      `database (${formatTarget(target)}). A dev server here would read and write real data. ` +
      'Point DATABASE_URL at your local database, or set ALLOW_REMOTE_DB=true if you really mean it.',
  };
}
