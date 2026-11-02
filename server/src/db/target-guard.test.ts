import { describe, expect, it } from 'bun:test';
import { parseCliArgs, runGuard } from './target-guard';
import type { GuardDeps } from './target-guard';

const LOCAL_URL =
  'postgresql://boss_tracker:s3cret@localhost:5432/boss_tracker';
const NEON_URL =
  'postgresql://owner:s3cret@ep-cool-name-123.neon.tech/neondb?sslmode=require';
const NEON_HOST = 'ep-cool-name-123.neon.tech';

function setup(
  env: Record<string, string | undefined>,
  answer: string | null = null,
) {
  const lines: string[] = [];
  const questions: string[] = [];
  const deps: GuardDeps = {
    env,
    log: (line) => lines.push(line),
    ask: (question) => {
      questions.push(question);
      return answer;
    },
  };
  return { deps, lines, questions };
}

describe('runGuard in dev mode', () => {
  it('runs against a local database, prints the target and never asks', () => {
    const { deps, lines, questions } = setup({ DATABASE_URL: LOCAL_URL });

    const result = runGuard('dev', { action: 'seed bosses' }, deps);

    expect(result).toEqual({ ok: true });
    expect(lines).toEqual([
      'Target: local database localhost:5432/boss_tracker',
    ]);
    expect(questions).toHaveLength(0);
  });

  it('refuses a remote database and says how to run production commands', () => {
    const { deps } = setup({ DATABASE_URL: NEON_URL });

    const result = runGuard('dev', { action: 'seed bosses' }, deps);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain('db:prod');
  });

  it('allows a remote database for a deploy only when the command opts in', () => {
    const env = { DATABASE_URL: NEON_URL, NODE_ENV: 'production' };

    expect(runGuard('dev', { action: 'migrate' }, setup(env).deps).ok).toBe(
      false,
    );
    const allowed = setup(env);
    expect(
      runGuard('dev', { action: 'migrate', allowDeploy: true }, allowed.deps),
    ).toEqual({ ok: true });
    expect(allowed.questions).toHaveLength(0);
  });
});

describe('runGuard in production mode', () => {
  it('shows a banner and proceeds when the exact host is typed', () => {
    const { deps, lines, questions } = setup(
      { DATABASE_URL: NEON_URL },
      NEON_HOST,
    );

    const result = runGuard(
      'production',
      { action: 'rotate token for paupauu' },
      deps,
    );

    expect(result).toEqual({ ok: true });
    expect(lines).toContain('PRODUCTION: rotate token for paupauu');
    expect(lines).toContain(`Target: REMOTE database ${NEON_HOST}:5432/neondb`);
    expect(questions).toHaveLength(1);
    expect(questions[0]).toContain(NEON_HOST);
  });

  it('accepts the host with different capitalisation or stray spaces', () => {
    const { deps } = setup(
      { DATABASE_URL: NEON_URL },
      `  ${NEON_HOST.toUpperCase()} \n`,
    );

    expect(runGuard('production', { action: 'x' }, deps).ok).toBe(true);
  });

  it('aborts on a wrong answer, a lazy "y", an empty answer or no input', () => {
    for (const answer of ['y', 'yes', '', 'neondb', 'localhost', null]) {
      const { deps } = setup({ DATABASE_URL: NEON_URL }, answer);

      const result = runGuard('production', { action: 'x' }, deps);

      expect(result.ok).toBe(false);
      expect(!result.ok && result.message).toContain('Nothing was changed');
    }
  });

  it('refuses a local database without asking anything', () => {
    const { deps, questions } = setup({ DATABASE_URL: LOCAL_URL }, 'localhost');

    const result = runGuard('production', { action: 'x' }, deps);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toContain('.env.neon');
    expect(questions).toHaveLength(0);
  });
});

describe('runGuard input handling', () => {
  it('reports a missing DATABASE_URL for each mode', () => {
    const dev = runGuard('dev', { action: 'x' }, setup({}).deps);
    const prod = runGuard('production', { action: 'x' }, setup({}).deps);

    expect(!dev.ok && dev.message).toContain('.env.development');
    expect(!prod.ok && prod.message).toContain('.env.neon');
  });

  it('reports an invalid DATABASE_URL without echoing it', () => {
    const result = runGuard(
      'dev',
      { action: 'x' },
      setup({ DATABASE_URL: 'oops s3cret' }).deps,
    );

    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).not.toContain('s3cret');
  });

  it('never prints credentials in any output', () => {
    for (const [mode, url, answer] of [
      ['dev', LOCAL_URL, null],
      ['production', NEON_URL, NEON_HOST],
      ['production', NEON_URL, 'wrong'],
      ['dev', NEON_URL, null],
    ] as const) {
      const { deps, lines, questions } = setup({ DATABASE_URL: url }, answer);
      const result = runGuard(mode, { action: 'x' }, deps);
      const everything = [
        ...lines,
        ...questions,
        result.ok ? '' : result.message,
      ].join('\n');

      expect(everything).not.toContain('s3cret');
      expect(everything).not.toContain('owner:');
      expect(everything).not.toContain('boss_tracker:s');
    }
  });
});

describe('parseCliArgs', () => {
  it('defaults to dev with no flags', () => {
    expect(parseCliArgs([])).toEqual({
      production: false,
      allowDeploy: false,
      positional: [],
    });
  });

  it('reads flags and keeps positional arguments in order', () => {
    expect(parseCliArgs(['--production', 'paupauu'])).toEqual({
      production: true,
      allowDeploy: false,
      positional: ['paupauu'],
    });
    expect(parseCliArgs(['Guest', '--allow-deploy'])).toEqual({
      production: false,
      allowDeploy: true,
      positional: ['Guest'],
    });
  });

  it('rejects unknown options instead of silently ignoring a typo', () => {
    expect(() => parseCliArgs(['--prodution', 'x'])).toThrow(
      'Unknown option --prodution',
    );
  });
});
