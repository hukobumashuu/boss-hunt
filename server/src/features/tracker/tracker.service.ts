import type { TrackerRepository } from './tracker.repository';
import { computeWindowState, compareByUrgency } from './tracker.derivation';
import type { TrackerEntry } from './tracker.types';

export class TrackerService {
  constructor(private readonly repo: TrackerRepository) {}

  async getTracker(now: Date = new Date()): Promise<TrackerEntry[]> {
    const rows = await this.repo.findLatestKillPerBossChannel();

    const entries: TrackerEntry[] = rows.map((row) => {
      const window = computeWindowState(
        row.lastKilledAt,
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
      };
    });

    return entries.sort(compareByUrgency);
  }
}
