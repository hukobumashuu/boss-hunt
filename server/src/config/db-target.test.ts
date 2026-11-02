import { describe, expect, it } from 'bun:test';
import {
  describeDatabaseTarget,
  evaluateServerStartup,
  evaluateTarget,
  formatTarget,
  isDeployContext,
} from './db-target';

const LOCAL = 'postgresql://boss_tracker:s3cret@localhost:5432/boss_tracker';
const NEON =
  'postgresql://owner:s3cret@ep-cool-name-123.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

describe('describeDatabaseTarget', () => {
  it('recognises local hosts', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]', 'LOCALHOST']) {
      const url = `postgresql://u:p@${host}:5432/db`;
      expect(describeDatabaseTarget(url).isLocal).toBe(true);
    }
  });

  it('treats a Neon host as remote and drops query parameters', () => {
    const target = describeDatabaseTarget(NEON);

    expect(target).toEqual({
      host: 'ep-cool-name-123.ap-southeast-1.aws.neon.tech',
      port: '5432',
      database: 'neondb',
      isLocal: false,
    });
  });

  it('is not fooled by look-alike host names', () => {
    for (const host of [
      'localhost.evil.com',
      'notlocalhost',
      '127.0.0.1.nip.io',
      'db.localhost.example',
    ]) {
      const url = `postgresql://u:p@${host}/db`;
      expect(describeDatabaseTarget(url).isLocal).toBe(false);
    }
  });

  it('reads the port, decodes the database name and defaults sensibly', () => {
    expect(describeDatabaseTarget('postgres://u:p@h:6543/my%20db').port).toBe(
      '6543',
    );
    expect(describeDatabaseTarget('postgres://u:p@h/my%20db').database).toBe(
      'my db',
    );
    expect(describeDatabaseTarget('postgres://u:p@h').database).toBe(
      '(default)',
    );
  });

  it('never exposes the user name or password', () => {
    const target = describeDatabaseTarget(LOCAL);

    expect(JSON.stringify(target)).not.toContain('s3cret');
    expect(JSON.stringify(target)).not.toContain('boss_tracker:');
    expect(formatTarget(target)).toBe('localhost:5432/boss_tracker');
  });

  it('rejects bad input without echoing the connection string', () => {
    const bad = [
      'not a url but has s3cret in it',
      'mysql://u:s3cret@host/db',
      'postgresql://u:s3cret@/db',
      'postgresql://u:s3cret@host/%E0%A4%A',
    ];
    for (const value of bad) {
      let message = '';
      try {
        describeDatabaseTarget(value);
      } catch (error) {
        message = error instanceof Error ? error.message : '';
      }
      expect(message).not.toBe('');
      expect(message).not.toContain('s3cret');
    }
  });
});

describe('evaluateTarget', () => {
  const local = describeDatabaseTarget(LOCAL);
  const remote = describeDatabaseTarget(NEON);

  it('lets dev commands run on a local database without a prompt', () => {
    expect(
      evaluateTarget({
        mode: 'dev',
        target: local,
        env: {},
        allowDeploy: false,
      }),
    ).toEqual({ allowed: true, requiresConfirmation: false });
  });

  it('refuses dev commands on a remote database and points at db:prod', () => {
    const decision = evaluateTarget({
      mode: 'dev',
      target: remote,
      env: {},
      allowDeploy: false,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('REMOTE');
    expect(decision.reason).toContain('db:prod');
    expect(decision.reason).not.toContain('s3cret');
  });

  it('refuses a dev command on a remote database even when NODE_ENV is production, unless deploys are allowed', () => {
    const env = { NODE_ENV: 'production' };

    expect(
      evaluateTarget({ mode: 'dev', target: remote, env, allowDeploy: false })
        .allowed,
    ).toBe(false);
    expect(
      evaluateTarget({ mode: 'dev', target: remote, env, allowDeploy: true }),
    ).toEqual({ allowed: true, requiresConfirmation: false });
  });

  it('recognises Render as a deploy context', () => {
    expect(
      evaluateTarget({
        mode: 'dev',
        target: remote,
        env: { RENDER: 'true' },
        allowDeploy: true,
      }).allowed,
    ).toBe(true);
  });

  it('does not treat a laptop with NODE_ENV=development as a deploy', () => {
    expect(isDeployContext({ NODE_ENV: 'development' })).toBe(false);
    expect(isDeployContext({ NODE_ENV: 'test' })).toBe(false);
    expect(isDeployContext({})).toBe(false);
    expect(isDeployContext({ RENDER: 'false' })).toBe(false);
  });

  it('lets production commands run on a remote database only after confirmation', () => {
    expect(
      evaluateTarget({
        mode: 'production',
        target: remote,
        env: {},
        allowDeploy: false,
      }),
    ).toEqual({ allowed: true, requiresConfirmation: true });
  });

  it('refuses production commands on a local database', () => {
    const decision = evaluateTarget({
      mode: 'production',
      target: local,
      env: {},
      allowDeploy: false,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('LOCAL');
  });
});

describe('evaluateServerStartup', () => {
  const local = describeDatabaseTarget(LOCAL);
  const remote = describeDatabaseTarget(NEON);

  it('always allows production', () => {
    expect(
      evaluateServerStartup({
        nodeEnv: 'production',
        target: remote,
        allowRemoteDb: false,
      }).allowed,
    ).toBe(true);
  });

  it('allows a local database in any environment', () => {
    for (const nodeEnv of ['development', 'test']) {
      expect(
        evaluateServerStartup({ nodeEnv, target: local, allowRemoteDb: false })
          .allowed,
      ).toBe(true);
    }
  });

  it('refuses a remote database outside production unless explicitly allowed', () => {
    const refused = evaluateServerStartup({
      nodeEnv: 'development',
      target: remote,
      allowRemoteDb: false,
    });

    expect(refused.allowed).toBe(false);
    expect(refused.reason).toContain('ALLOW_REMOTE_DB=true');
    expect(refused.reason).not.toContain('s3cret');
    expect(
      evaluateServerStartup({
        nodeEnv: 'development',
        target: remote,
        allowRemoteDb: true,
      }).allowed,
    ).toBe(true);
  });
});
