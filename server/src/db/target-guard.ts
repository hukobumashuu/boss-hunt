import {
  describeDatabaseTarget,
  evaluateTarget,
  formatTarget,
} from '../config/db-target';
import type { TargetMode } from '../config/db-target';

export interface GuardOptions {
  action: string;
  allowDeploy?: boolean;
}

export interface GuardDeps {
  env: Record<string, string | undefined>;
  log: (line: string) => void;
  ask: (question: string) => string | null;
}

export type GuardResult = { ok: true } | { ok: false; message: string };

const fail = (message: string): GuardResult => ({ ok: false, message });

export function runGuard(
  mode: TargetMode,
  options: GuardOptions,
  deps: GuardDeps,
): GuardResult {
  const url = deps.env['DATABASE_URL'];
  if (!url) {
    return fail(
      mode === 'production'
        ? 'DATABASE_URL is not set. Put the production URL in server/.env.neon.'
        : 'DATABASE_URL is not set. Check server/.env.development.',
    );
  }

  let target;
  try {
    target = describeDatabaseTarget(url);
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : 'Invalid DATABASE_URL.',
    );
  }

  const decision = evaluateTarget({
    mode,
    target,
    env: deps.env,
    allowDeploy: options.allowDeploy ?? false,
  });
  if (!decision.allowed) {
    return fail(decision.reason ?? 'Refused.');
  }

  if (mode === 'production') {
    deps.log('');
    deps.log(`PRODUCTION: ${options.action}`);
    deps.log(`Target: REMOTE database ${formatTarget(target)}`);
    if (decision.requiresConfirmation) {
      const typed = deps.ask(
        `Type the database host (${target.host}) to continue: `,
      );
      if (typed === null || typed.trim().toLowerCase() !== target.host) {
        return fail('Confirmation did not match. Nothing was changed.');
      }
    }
  } else {
    deps.log(
      `Target: ${target.isLocal ? 'local' : 'remote (deploy)'} database ${formatTarget(target)}`,
    );
  }
  return { ok: true };
}

export function enforceTarget(mode: TargetMode, options: GuardOptions): void {
  const result = runGuard(mode, options, {
    env: process.env,
    log: (line) => console.log(line),
    ask: (question) => prompt(question),
  });
  if (!result.ok) {
    console.error(`\n${result.message}\n`);
    process.exit(1);
  }
}

export interface CliArgs {
  production: boolean;
  allowDeploy: boolean;
  positional: string[];
}

const KNOWN_FLAGS: ReadonlySet<string> = new Set([
  '--production',
  '--allow-deploy',
]);

export function parseCliArgs(argv: readonly string[]): CliArgs {
  const unknown = argv.find(
    (arg) => arg.startsWith('--') && !KNOWN_FLAGS.has(arg),
  );
  if (unknown) {
    throw new Error(`Unknown option ${unknown}`);
  }
  return {
    production: argv.includes('--production'),
    allowDeploy: argv.includes('--allow-deploy'),
    positional: argv.filter((arg) => !arg.startsWith('--')),
  };
}
