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
