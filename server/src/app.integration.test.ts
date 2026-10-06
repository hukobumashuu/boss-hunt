import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import type { Server } from 'node:http';
import type { Express } from 'express';

const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl) {
  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, '');
  if (!databaseName.toLowerCase().includes('test')) {
    throw new Error(
      `Refusing to run integration tests against database "${databaseName}": integration tests delete all rows. Use a database whose name contains "test" (see .env.test.example).`,
    );
  }
}

const integration = databaseUrl ? describe : describe.skip;

interface ApiBody {
  success: boolean;
  message: string;
  data?: unknown;
  errors?: Array<{ field: string; message: string }>;
}

interface TrackerRow {
  bossId: number;
  channel: number;
  isStale: boolean;
}

interface CoverageRow {
  bossId: number;
  missing: number[];
  stale: Array<{ channel: number; missed: number }>;
}

const OWNER_TOKEN = 'integration-test-token';
const OTHER_TOKEN = 'integration-test-other-token';
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function listen(
  app: Express,
): Promise<{ server: Server; baseUrl: string }> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not determine integration-test server address');
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

function close(server: Server): Promise<void> {
  return new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

integration('API integration', () => {
  let server: Server;
  let baseUrl: string;
  let db: typeof import('./config/db').db;
  let schema: typeof import('./db/schema');

  beforeAll(async () => {
    ({ db } = await import('./config/db'));
    schema = await import('./db/schema');
    const { createApp } = await import('./app');
    ({ server, baseUrl } = await listen(createApp()));
  });

  afterEach(async () => {
    await db.delete(schema.serverResets);
    await db.delete(schema.killEvents);
    await db.delete(schema.loggers);
    await db.delete(schema.bosses);
  });

  afterAll(async () => {
    await close(server);
  });

  async function seed() {
    const [boss] = await db
      .insert(schema.bosses)
      .values({
        name: 'Integration Boss',
        map: 'Test Map',
        respawnIntervalHours: 4,
      })
      .returning();
    const [owner] = await db
      .insert(schema.loggers)
      .values({ name: 'Integration Logger', tokenHash: hashToken(OWNER_TOKEN) })
      .returning();
    if (!boss || !owner) throw new Error('Failed to seed boss and logger');
    return { boss, owner };
  }

  async function seedOtherLogger() {
    const [other] = await db
      .insert(schema.loggers)
      .values({ name: 'Other Logger', tokenHash: hashToken(OTHER_TOKEN) })
      .returning();
    if (!other) throw new Error('Failed to seed second logger');
    return other;
  }

  async function insertKill(
    bossId: number,
    channel: number,
    loggerId: number,
    killedAt: Date,
  ) {
    const [kill] = await db
      .insert(schema.killEvents)
      .values({ bossId, channel, loggerId, killedAt })
      .returning();
    if (!kill) throw new Error('Failed to insert kill');
    return kill;
  }

  async function call(
    method: 'GET' | 'POST',
    path: string,
    options: { token?: string | null; body?: unknown } = {},
  ) {
    const token = options.token === undefined ? OWNER_TOKEN : options.token;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const init: RequestInit = { method, headers };
    if (options.body !== undefined) init.body = JSON.stringify(options.body);
    const response = await fetch(`${baseUrl}${path}`, init);
    return {
      status: response.status,
      body: (await response.json()) as ApiBody,
    };
  }

  describe('health and authentication', () => {
    it('serves /health without a token', async () => {
      const { status, body } = await call('GET', '/health', { token: null });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('rejects an API request without an Authorization header', async () => {
      await seed();
      const { status, body } = await call('GET', '/api/tracker', {
        token: null,
      });

      expect(status).toBe(401);
      expect(body).toMatchObject({
        success: false,
        message: 'Missing or malformed Authorization header',
      });
    });

    it('rejects an unknown token', async () => {
      await seed();
      const { status, body } = await call('GET', '/api/tracker', {
        token: 'not-a-real-token',
      });

      expect(status).toBe(401);
      expect(body).toMatchObject({
        success: false,
        message: 'Invalid API token',
      });
    });

    it('rejects every protected route without a token', async () => {
      await seed();
      for (const [method, path] of [
        ['GET', '/api/bosses'],
        ['GET', '/api/tracker'],
        ['GET', '/api/coverage'],
        ['GET', '/api/resets/latest'],
        ['POST', '/api/kills'],
        ['POST', '/api/kills/1/void'],
        ['POST', '/api/resets'],
      ] as const) {
        const { status } = await call(method, path, { token: null });
        expect(status).toBe(401);
      }
    });

    it('returns 400 for a malformed JSON body', async () => {
      await seed();
      const response = await fetch(`${baseUrl}/api/kills`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OWNER_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: '{not json',
      });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        success: false,
        message: 'Invalid request body',
      });
    });
  });

  describe('logging kills', () => {
    it('logs a kill and returns it through the tracker', async () => {
      const { boss } = await seed();
      const log = await call('POST', '/api/kills', {
        body: { bossId: boss.id, channel: 4 },
      });
      const tracker = await call('GET', '/api/tracker');

      expect(log.status).toBe(201);
      expect(tracker.status).toBe(200);
      expect(tracker.body.success).toBe(true);
      expect(tracker.body.data as TrackerRow[]).toMatchObject([
        { bossId: boss.id, channel: 4, isStale: false },
      ]);
    });

    it('returns a duplicate warning before the first respawn boundary', async () => {
      const { boss } = await seed();
      const first = await call('POST', '/api/kills', {
        body: { bossId: boss.id, channel: 4 },
      });
      const second = await call('POST', '/api/kills', {
        body: { bossId: boss.id, channel: 4 },
      });

      expect(first.status).toBe(201);
      expect(second.status).toBe(409);
      expect(second.body.data).toMatchObject({
        lastLoggedBy: 'Integration Logger',
      });
    });

    it('logs a duplicate anyway when force is true', async () => {
      const { boss } = await seed();
      await call('POST', '/api/kills', {
        body: { bossId: boss.id, channel: 4 },
      });
      const forced = await call('POST', '/api/kills', {
        body: { bossId: boss.id, channel: 4, force: true },
      });

      expect(forced.status).toBe(201);
    });

    it('returns 404 for a boss that does not exist', async () => {
      await seed();
      const { status, body } = await call('POST', '/api/kills', {
        body: { bossId: 999999, channel: 4 },
      });

      expect(status).toBe(404);
      expect(body.success).toBe(false);
    });

    it('rejects invalid payloads with field errors', async () => {
      const { boss } = await seed();
      const invalid: unknown[] = [
        {},
        { bossId: boss.id },
        { channel: 4 },
        { bossId: boss.id, channel: 0 },
        { bossId: boss.id, channel: 31 },
        { bossId: boss.id, channel: 1.5 },
        { bossId: String(boss.id), channel: 4 },
        { bossId: -1, channel: 4 },
        { bossId: boss.id, channel: 4, force: 'yes' },
      ];

      for (const body of invalid) {
        const response = await call('POST', '/api/kills', { body });
        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Validation failed');
        expect(response.body.errors?.length).toBeGreaterThan(0);
      }
    });

    it('allows a new kill right after a reset moved the baseline', async () => {
      const { boss, owner } = await seed();
      await insertKill(
        boss.id,
        7,
        owner.id,
        new Date(Date.now() - 3 * HOUR_MS),
      );

      const beforeReset = await call('POST', '/api/kills', {
        body: { bossId: boss.id, channel: 7 },
      });
      const reset = await call('POST', '/api/resets');
      const afterReset = await call('POST', '/api/kills', {
        body: { bossId: boss.id, channel: 7 },
      });

      expect(beforeReset.status).toBe(409);
      expect(reset.status).toBe(201);
      expect(afterReset.status).toBe(201);
    });
  });

  describe('voiding kills', () => {
    it('voids a kill the caller just logged and removes it from the tracker', async () => {
      const { boss } = await seed();
      const log = await call('POST', '/api/kills', {
        body: { bossId: boss.id, channel: 4 },
      });
      const killId = (log.body.data as { id: number }).id;

      const voided = await call('POST', `/api/kills/${killId}/void`);
      const tracker = await call('GET', '/api/tracker');

      expect(voided.status).toBe(200);
      expect(tracker.body.data).toEqual([]);
    });

    it('keeps the voided kill out of a second void', async () => {
      const { boss } = await seed();
      const log = await call('POST', '/api/kills', {
        body: { bossId: boss.id, channel: 4 },
      });
      const killId = (log.body.data as { id: number }).id;

      await call('POST', `/api/kills/${killId}/void`);
      const again = await call('POST', `/api/kills/${killId}/void`);

      expect(again.status).toBe(404);
    });

    it('returns 404 for a kill that does not exist', async () => {
      await seed();
      const { status } = await call('POST', '/api/kills/999999/void');

      expect(status).toBe(404);
    });

    it('returns 400 for an invalid kill id', async () => {
      await seed();
      for (const id of ['abc', '0', '-3', '1.5']) {
        const { status, body } = await call('POST', `/api/kills/${id}/void`);
        expect(status).toBe(400);
        expect(body.message).toBe('Invalid kill id');
      }
    });

    it("refuses to void another logger's kill", async () => {
      const { boss } = await seed();
      await seedOtherLogger();
      const log = await call('POST', '/api/kills', {
        body: { bossId: boss.id, channel: 4 },
      });
      const killId = (log.body.data as { id: number }).id;

      const { status } = await call('POST', `/api/kills/${killId}/void`, {
        token: OTHER_TOKEN,
      });

      expect(status).toBe(403);
    });

    it('refuses to void a kill outside the void window', async () => {
      const { boss, owner } = await seed();
      const old = await insertKill(
        boss.id,
        4,
        owner.id,
        new Date(Date.now() - 10 * MINUTE_MS),
      );

      const { status, body } = await call('POST', `/api/kills/${old.id}/void`);

      expect(status).toBe(400);
      expect(body.message).toBe('This was logged too long ago to void');
    });

    it('refuses to void a kill once a newer kill exists for the channel', async () => {
      const { boss, owner } = await seed();
      const older = await insertKill(
        boss.id,
        4,
        owner.id,
        new Date(Date.now() - 3 * MINUTE_MS),
      );
      await insertKill(
        boss.id,
        4,
        owner.id,
        new Date(Date.now() - 1 * MINUTE_MS),
      );

      const { status } = await call('POST', `/api/kills/${older.id}/void`);

      expect(status).toBe(400);
    });
  });

  describe('resets, bosses and coverage', () => {
    it('returns null before any reset has been logged', async () => {
      await seed();
      const { status, body } = await call('GET', '/api/resets/latest');

      expect(status).toBe(200);
      expect(body.data).toBeNull();
    });

    it('logs a reset and returns it as the latest', async () => {
      await seed();
      const created = await call('POST', '/api/resets');
      const latest = await call('GET', '/api/resets/latest');

      expect(created.status).toBe(201);
      expect(latest.status).toBe(200);
      expect(latest.body.data).toMatchObject({
        id: (created.body.data as { id: number }).id,
      });
    });

    it('lists the seeded bosses', async () => {
      const { boss } = await seed();
      const { status, body } = await call('GET', '/api/bosses');

      expect(status).toBe(200);
      expect(body.data).toMatchObject([
        { id: boss.id, name: 'Integration Boss', respawnIntervalHours: 4 },
      ]);
    });

    it('reports every channel as missing until it has been logged', async () => {
      const { boss } = await seed();
      await call('POST', '/api/kills', {
        body: { bossId: boss.id, channel: 4 },
      });
      const { status, body } = await call('GET', '/api/coverage');
      const [entry] = body.data as CoverageRow[];

      expect(status).toBe(200);
      expect(entry?.bossId).toBe(boss.id);
      expect(entry?.missing).toHaveLength(29);
      expect(entry?.missing).not.toContain(4);
      expect(entry?.stale).toEqual([]);
    });

    it('lists a channel as stale after several missed windows', async () => {
      const { boss, owner } = await seed();
      await insertKill(
        boss.id,
        9,
        owner.id,
        new Date(Date.now() - 30 * HOUR_MS),
      );
      const { body } = await call('GET', '/api/coverage');
      const [entry] = body.data as CoverageRow[];

      expect(entry?.stale.map((s) => s.channel)).toEqual([9]);
      expect(entry?.missing).not.toContain(9);
    });
  });
});

integration('API rate limiting', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const { createApp } = await import('./app');
    const { createRateLimiter } =
      await import('./shared/middlewares/rate-limit');
    ({ server, baseUrl } = await listen(
      createApp({ rateLimiter: createRateLimiter(2) }),
    ));
  });

  afterAll(async () => {
    await close(server);
  });

  function hit(clientIp: string) {
    return fetch(`${baseUrl}/api/tracker`, {
      headers: { 'X-Forwarded-For': clientIp },
    });
  }

  it('returns 429 with an error body once the limit is exceeded', async () => {
    const statuses: number[] = [];
    let last: Response | undefined;
    for (let i = 0; i < 3; i++) {
      last = await hit('10.0.0.1');
      statuses.push(last.status);
    }

    expect(statuses).toEqual([401, 401, 429]);
    expect(await last?.json()).toMatchObject({
      success: false,
      message: 'Too many requests - try again later.',
    });
  });

  it('keeps a separate bucket for each client behind the proxy', async () => {
    await hit('10.0.0.2');
    await hit('10.0.0.2');
    const exhausted = await hit('10.0.0.2');
    const otherClient = await hit('10.0.0.3');

    expect(exhausted.status).toBe(429);
    expect(otherClient.status).toBe(401);
  });

  it('ignores a spoofed first hop in X-Forwarded-For', async () => {
    await hit('1.1.1.1, 10.0.0.4');
    await hit('2.2.2.2, 10.0.0.4');
    const third = await hit('3.3.3.3, 10.0.0.4');

    expect(third.status).toBe(429);
  });
});
