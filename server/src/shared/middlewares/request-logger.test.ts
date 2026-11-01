import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import type { Server } from 'node:http';
import express from 'express';
import { requestLogger } from './request-logger';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function start(slowMs: number) {
  const app = express();
  app.use(requestLogger(slowMs));
  app.get('/fast', (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/slow', async (_req, res) => {
    await sleep(slowMs * 3);
    res.json({ ok: true });
  });
  app.get('/boom', (_req, res) => {
    res.status(500).json({ ok: false });
  });
  app.get('/hang', () => {
    // never responds
  });

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no address');
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

describe('requestLogger', () => {
  const warn = spyOn(console, 'warn').mockImplementation(() => {});
  let server: Server | undefined;

  afterEach(async () => {
    warn.mockClear();
    if (server) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      server = undefined;
    }
  });

  it('stays quiet for fast successful requests', async () => {
    const started = await start(500);
    server = started.server;

    await fetch(`${started.baseUrl}/fast`);
    await sleep(20);

    expect(warn).not.toHaveBeenCalled();
  });

  it('logs slow requests with method, path, status and duration', async () => {
    const started = await start(30);
    server = started.server;

    await fetch(`${started.baseUrl}/slow`);
    await sleep(20);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(
      /^\[request\] GET \/slow -> 200 in \d+ms$/,
    );
  });

  it('logs server errors even when they are fast', async () => {
    const started = await start(500);
    server = started.server;

    await fetch(`${started.baseUrl}/boom`);
    await sleep(20);

    expect(String(warn.mock.calls[0]?.[0])).toContain('/boom -> 500');
  });

  it('logs requests the client abandoned before an answer', async () => {
    const started = await start(500);
    server = started.server;
    const controller = new AbortController();

    const pending = fetch(`${started.baseUrl}/hang`, {
      signal: controller.signal,
    }).catch(() => undefined);
    await sleep(50);
    controller.abort();
    await pending;
    await sleep(100);

    expect(String(warn.mock.calls[0]?.[0])).toContain(
      '/hang -> aborted by client',
    );
  });

  it('never logs query strings', async () => {
    const started = await start(30);
    server = started.server;

    await fetch(`${started.baseUrl}/slow?token=super-secret`);
    await sleep(20);

    expect(String(warn.mock.calls[0]?.[0])).not.toContain('super-secret');
  });
});
