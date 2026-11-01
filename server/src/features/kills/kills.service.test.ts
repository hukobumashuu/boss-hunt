import { describe, expect, it } from 'bun:test';
import { DuplicateKillWarning } from '../../shared/utils/app-error';
import { KillService } from './kills.service';
import type { KillRepository } from './kills.repository';
import type { ResetRepository } from '../resets/resets.repository';

const logger = { id: 1, name: 'p3anut' };
const killedAt = new Date('2026-01-01T00:00:00.000Z');

function createService(nowKill = killedAt) {
  const repository = {
    findBossById: async () => ({ id: 1, respawnIntervalHours: 4 }),
    findLatestKill: async () => ({
      id: 7,
      killedAt,
      loggerName: 'stasha',
    }),
    insertKill: async () => ({
      id: 8,
      bossId: 1,
      channel: 1,
      loggerId: 1,
      killedAt: nowKill,
      voidedAt: null,
    }),
  } as unknown as KillRepository;
  const resetRepository = {
    findLatest: async () => null,
  } as unknown as ResetRepository;

  return new KillService(repository, resetRepository);
}

describe('KillService.logKill', () => {
  it('blocks a duplicate before the first respawn boundary', async () => {
    const service = createService();

    await expect(
      service.logKill(
        { bossId: 1, channel: 1, force: false },
        logger,
        new Date('2026-01-01T03:59:00.000Z'),
      ),
    ).rejects.toBeInstanceOf(DuplicateKillWarning);
  });

  it('allows a log after the first respawn boundary even after grace rolls the row forward', async () => {
    const service = createService();

    await expect(
      service.logKill(
        { bossId: 1, channel: 1, force: false },
        logger,
        new Date('2026-01-01T04:15:00.000Z'),
      ),
    ).resolves.toMatchObject({ id: 8, loggedByName: 'p3anut' });
  });

  it('warns when a due channel has missed five or more windows', async () => {
    const service = createService();

    await expect(
      service.logKill(
        { bossId: 1, channel: 1, force: false },
        logger,
        new Date('2026-01-02T02:00:00.000Z'),
      ),
    ).rejects.toMatchObject({
      message:
        "Ch 1 hasn't been confirmed in 6 cycles - might not be ours anymore. Log anyway?",
    });
  });

  it('formats duplicate warning times in Manila time', async () => {
    const service = createService();

    await expect(
      service.logKill(
        { bossId: 1, channel: 1, force: false },
        logger,
        new Date('2026-01-01T01:00:00.000Z'),
      ),
    ).rejects.toMatchObject({ message: expect.stringContaining('12:00 PM') });
  });
});

const MINUTE_MS = 60 * 1000;
const REQUEST_ID = '3f0c4d2e-7a55-4c1e-9b0a-5d8f6a1e2c10';

interface SpyOptions {
  latest?: { id: number; killedAt: Date; loggerName: string } | null;
  replay?: Record<string, unknown> | null;
}

function createSpyService(options: SpyOptions = {}) {
  const inserted: Record<string, unknown>[] = [];
  const repository = {
    findBossById: async () => ({ id: 1, respawnIntervalHours: 4 }),
    findLatestKill: async () => options.latest ?? null,
    findKillByRequestId: async () => options.replay ?? null,
    insertKill: async (input: Record<string, unknown>) => {
      inserted.push(input);
      return { id: 9, voidedAt: null, createdAt: new Date(), ...input };
    },
  } as unknown as KillRepository;
  const resetRepository = {
    findLatest: async () => null,
  } as unknown as ResetRepository;

  return { service: new KillService(repository, resetRepository), inserted };
}

describe('KillService.logKill kill time', () => {
  const now = new Date('2026-01-01T10:00:00.000Z');

  it('records the kill as happening killedAgoMs before the request arrived', async () => {
    const { service, inserted } = createSpyService();

    await service.logKill(
      { bossId: 1, channel: 3, force: false, killedAgoMs: 5 * MINUTE_MS },
      logger,
      now,
    );

    expect(inserted[0]?.killedAt).toEqual(new Date('2026-01-01T09:55:00.000Z'));
  });

  it('records the arrival time when no age is given', async () => {
    const { service, inserted } = createSpyService();

    await service.logKill({ bossId: 1, channel: 3, force: false }, logger, now);

    expect(inserted[0]?.killedAt).toEqual(now);
  });

  it('judges the duplicate guard at the claimed kill time, not the arrival time', async () => {
    // Prior kill at 00:00 with a 4h interval: due from 04:00. The request
    // arrives at 04:02 but claims the kill happened at 03:57, before it was due.
    const { service } = createSpyService({
      latest: { id: 7, killedAt, loggerName: 'stasha' },
    });
    const arrival = new Date('2026-01-01T04:02:00.000Z');

    await expect(
      service.logKill(
        { bossId: 1, channel: 3, force: false, killedAgoMs: 5 * MINUTE_MS },
        logger,
        arrival,
      ),
    ).rejects.toBeInstanceOf(DuplicateKillWarning);
    await expect(
      service.logKill({ bossId: 1, channel: 3, force: false }, logger, arrival),
    ).resolves.toMatchObject({ id: 9 });
  });

  it('skips the duplicate guard when forced, even for a back-dated kill', async () => {
    const { service, inserted } = createSpyService({
      latest: { id: 7, killedAt, loggerName: 'stasha' },
    });

    await service.logKill(
      { bossId: 1, channel: 3, force: true, killedAgoMs: 2 * MINUTE_MS },
      logger,
      new Date('2026-01-01T01:00:00.000Z'),
    );

    expect(inserted).toHaveLength(1);
  });
});

describe('KillService.logKill idempotency', () => {
  const now = new Date('2026-01-01T10:00:00.000Z');

  it('passes the requestId to the insert', async () => {
    const { service, inserted } = createSpyService();

    await service.logKill(
      { bossId: 1, channel: 3, force: false, requestId: REQUEST_ID },
      logger,
      now,
    );

    expect(inserted[0]?.requestId).toBe(REQUEST_ID);
  });

  it('leaves requestId out of the insert when none was sent', async () => {
    const { service, inserted } = createSpyService();

    await service.logKill({ bossId: 1, channel: 3, force: false }, logger, now);

    expect('requestId' in (inserted[0] ?? {})).toBe(false);
  });

  it('returns the earlier kill for a replayed requestId without inserting or warning', async () => {
    const { service, inserted } = createSpyService({
      // Would trigger the duplicate guard if the replay did not short-circuit.
      latest: { id: 8, killedAt: now, loggerName: 'p3anut' },
      replay: { id: 8, bossId: 1, channel: 3, loggerId: 1, killedAt: now },
    });

    await expect(
      service.logKill(
        { bossId: 1, channel: 3, force: false, requestId: REQUEST_ID },
        logger,
        now,
      ),
    ).resolves.toMatchObject({ id: 8, loggedByName: 'p3anut' });
    expect(inserted).toHaveLength(0);
  });

  it('returns the original kill when a retry overlaps it and sees it as a duplicate', async () => {
    // First lookup (before the guard) finds nothing; by the time the guard
    // runs, the original request has stored its kill.
    let lookups = 0;
    const stored = {
      id: 8,
      bossId: 1,
      channel: 3,
      loggerId: 1,
      killedAt: now,
    };
    const repository = {
      findBossById: async () => ({ id: 1, respawnIntervalHours: 4 }),
      findLatestKill: async () => ({
        id: 8,
        killedAt: now,
        loggerName: 'p3anut',
      }),
      findKillByRequestId: async () => (++lookups === 1 ? null : stored),
      insertKill: async () => {
        throw new Error('must not insert twice');
      },
    } as unknown as KillRepository;
    const resetRepository = {
      findLatest: async () => null,
    } as unknown as ResetRepository;
    const service = new KillService(repository, resetRepository);

    await expect(
      service.logKill(
        { bossId: 1, channel: 3, force: false, requestId: REQUEST_ID },
        logger,
        now,
      ),
    ).resolves.toMatchObject({ id: 8, loggedByName: 'p3anut' });
  });

  it('still warns about a genuine duplicate that has a different requestId', async () => {
    const { service } = createSpyService({
      latest: { id: 8, killedAt: now, loggerName: 'stasha' },
    });

    await expect(
      service.logKill(
        { bossId: 1, channel: 3, force: false, requestId: REQUEST_ID },
        logger,
        now,
      ),
    ).rejects.toBeInstanceOf(DuplicateKillWarning);
  });
});
