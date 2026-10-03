import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { createHash } from 'node:crypto';
import type { Server } from 'node:http';

const integration = process.env.DATABASE_URL ? describe : describe.skip;

integration('API integration', () => {
  let server: Server;
  let baseUrl: string;
  let db: typeof import('./config/db').db;
  let schema: typeof import('./db/schema');
  const token = 'integration-test-token';

  beforeAll(async () => {
    ({ db } = await import('./config/db'));
    schema = await import('./db/schema');
    const { createApp } = await import('./app');
    server = createApp().listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Could not determine integration-test server address');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await db.delete(schema.serverResets);
    await db.delete(schema.killEvents);
    await db.delete(schema.loggers);
    await db.delete(schema.bosses);
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
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
    if (!boss) throw new Error('Failed to seed boss');
    await db.insert(schema.loggers).values({
      name: 'Integration Logger',
      tokenHash: createHash('sha256').update(token).digest('hex'),
    });
    return boss;
  }

  function authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  it('logs a kill and returns it through the tracker', async () => {
    const boss = await seed();
    const logResponse = await fetch(`${baseUrl}/api/kills`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ bossId: boss.id, channel: 4 }),
    });

    expect(logResponse.status).toBe(201);

    const trackerResponse = await fetch(`${baseUrl}/api/tracker`, {
      headers: authHeaders(),
    });
    const trackerBody = (await trackerResponse.json()) as {
      success: boolean;
      data: Array<{ bossId: number; channel: number; isStale: boolean }>;
    };

    expect(trackerResponse.status).toBe(200);
    expect(trackerBody.success).toBe(true);
    expect(trackerBody.data).toMatchObject([
      { bossId: boss.id, channel: 4, isStale: false },
    ]);
  });

  it('returns a duplicate warning before the first respawn boundary', async () => {
    const boss = await seed();
    const input = JSON.stringify({ bossId: boss.id, channel: 4 });
    const first = await fetch(`${baseUrl}/api/kills`, {
      method: 'POST',
      headers: authHeaders(),
      body: input,
    });
    const second = await fetch(`${baseUrl}/api/kills`, {
      method: 'POST',
      headers: authHeaders(),
      body: input,
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
  });
});
