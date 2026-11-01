import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import type { Request, Response } from 'express';
import { createDbHealthHandler } from './db-health';

async function run(handler: ReturnType<typeof createDbHealthHandler>) {
  let statusCode = 0;
  let body: unknown;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  } as unknown as Response;

  await handler({} as Request, res, () => {});
  return { statusCode, body };
}

describe('createDbHealthHandler', () => {
  const consoleError = spyOn(console, 'error').mockImplementation(() => {});

  afterEach(() => {
    consoleError.mockClear();
  });

  it('returns 200 with the measured latency when the database answers', async () => {
    const { statusCode, body } = await run(
      createDbHealthHandler(async () => {}),
    );

    expect(statusCode).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: { status: 'ok', dbLatencyMs: expect.any(Number) },
    });
  });

  it('returns 503 and logs when the database check fails', async () => {
    const { statusCode, body } = await run(
      createDbHealthHandler(async () => {
        throw new Error('connection refused');
      }),
    );

    expect(statusCode).toBe(503);
    expect(body).toEqual({ success: false, message: 'Database unreachable' });
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it('returns 503 instead of hanging when the database never answers', async () => {
    const { statusCode } = await run(
      createDbHealthHandler(() => new Promise<void>(() => {}), 25),
    );

    expect(statusCode).toBe(503);
  });
});
