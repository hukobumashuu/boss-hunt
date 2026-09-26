import type { TrackerRepository } from './tracker.repository';
import type { ResetRepository } from '../resets/resets.repository';
import {
  computeWindowState,
  compareByUrgency,
  effectiveLastKilledAt,
} from './tracker.derivation';
import type { TrackerEntry } from './tracker.types';

export class TrackerService {
  constructor(
    private readonly repo: TrackerRepository,
    private readonly resetRepo: ResetRepository,
  ) {}

  async getTracker(now: Date = new Date()): Promise<TrackerEntry[]> {
    const [rows, latestReset] = await Promise.all([
      this.repo.findLatestKillPerBossChannel(),
      this.resetRepo.findLatest(),
    ]);

    const entries: TrackerEntry[] = rows.map((row) => {
      const baseline = effectiveLastKilledAt(
        row.lastKilledAt,
        row.respawnIntervalHours,
        latestReset?.resetAt ?? null,
      );
      const window = computeWindowState(
        baseline,
        row.respawnIntervalHours,
        now,
      );
      return {
        bossId: row.bossId,
        bossName: row.bossName,
        map: row.map,
        channel: row.channel,
        lastKilledAt: row.lastKilledAt,
        nextWindowAt: window.nextWindowAt,
        windowsElapsed: window.windowsElapsed,
        status: window.status,
        respawnIntervalHours: row.respawnIntervalHours,
      };
    });

    return entries.sort(compareByUrgency);
  }
}
