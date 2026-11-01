import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import type { Server } from 'node:http';
import express from 'express';
import { requestTimeout } from './request-timeout';
import { errorHandler } from './error-handler';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function start(timeoutMs: number) {
  const app = express();
  app.use(requestTimeout(timeoutMs));
  app.get('/fast', (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/hang', () => {});
  app.get('/late', async (_req, res, next) => {
    await sleep(timeoutMs * 4);
    try {
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });
  app.use(errorHandler);

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no address');
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

describe('requestTimeout', () => {
  const consoleError = spyOn(console, 'error').mockImplementation(() => {});
  let server: Server | undefined;

  afterEach(async () => {
    consoleError.mockClear();
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      server = undefined;
    }
  });

  it('answers 503 with a readable message when a request is still running', async () => {
    const started = await start(50);
    server = started.server;

    const response = await fetch(`${started.baseUrl}/hang`);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      success: false,
      message: 'The server took too long to respond. Please try again.',
    });
    expect(consoleError).toHaveBeenCalledTimes(1);
  });

  it('does not touch requests that finish in time', async () => {
    const started = await start(200);
    server = started.server;

    const response = await fetch(`${started.baseUrl}/fast`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('keeps serving after a handler answers too late', async () => {
    const started = await start(30);
    server = started.server;

    const timedOut = await fetch(`${started.baseUrl}/late`);
    await sleep(250);
    const healthy = await fetch(`${started.baseUrl}/fast`);

    expect(timedOut.status).toBe(503);
    expect(healthy.status).toBe(200);
  });
});
