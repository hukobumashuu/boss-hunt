import type { WindowStatus } from './tracker.derivation';

export interface TrackerEntry {
  bossId: number;
  bossName: string;
  map: string;
  channel: number;
  lastKilledAt: Date;
  nextWindowAt: Date;
  windowsElapsed: number;
  status: WindowStatus;
  respawnIntervalHours: number;
}
