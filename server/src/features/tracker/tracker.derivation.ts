/**
 * Core respawn-window math, isolated from Express/Drizzle so it can be
 * unit tested with plain inputs and no database.
 *
 * Confirmed mechanic: the game only rolls for a spawn at fixed tick
 * boundaries (killedAt + n * intervalHours), not continuously. Once a
 * boss is alive it stays alive until killed - so once the *first* tick
 * has passed with no kill logged, the boss may already be up, and it
 * stays "possibly up" (not a shrinking window) until someone logs a kill.
 * Each additional elapsed tick is informational (higher cumulative odds
 * it's already up) but doesn't change what a hunter should do: go check.
 */

export type WindowStatus = 'locked' | 'opening_soon' | 'open';

export interface WindowState {
  /** Number of respawn ticks that have already passed with no kill logged. */
  windowsElapsed: number;
  /** The next upcoming tick boundary (informational once already open). */
  nextWindowAt: Date;
  status: WindowStatus;
}

/** Ticks within this many minutes of the first boundary show as amber. */
const OPENING_SOON_THRESHOLD_MINUTES = 30;

export function computeWindowState(
  lastKilledAt: Date,
  respawnIntervalHours: number,
  now: Date = new Date(),
): WindowState {
  if (respawnIntervalHours <= 0) {
    throw new Error('respawnIntervalHours must be positive');
  }

  const intervalMs = respawnIntervalHours * 60 * 60 * 1000;
  const elapsedMs = now.getTime() - lastKilledAt.getTime();

  // How many full ticks have already occurred (0 = still before the first
  // window). Guard against negative elapsed time (clock skew / bad data).
  const windowsElapsed = Math.max(0, Math.floor(elapsedMs / intervalMs));

  const nextWindowAt = new Date(
    lastKilledAt.getTime() + intervalMs * (windowsElapsed + 1),
  );

  const status = deriveStatus(windowsElapsed, nextWindowAt, now);

  return { windowsElapsed, nextWindowAt, status };
}

function deriveStatus(
  windowsElapsed: number,
  nextWindowAt: Date,
  now: Date,
): WindowStatus {
  if (windowsElapsed >= 1) {
    // First tick has already passed with no kill logged -> may already be up.
    return 'open';
  }

  const minutesUntilFirstWindow =
    (nextWindowAt.getTime() - now.getTime()) / (60 * 1000);

  return minutesUntilFirstWindow <= OPENING_SOON_THRESHOLD_MINUTES
    ? 'opening_soon'
    : 'locked';
}

/** Sort priority for the dashboard: open (possibly up) first, then
 * opening_soon by soonest, then locked by soonest. Alphabetical is
 * never the sort key. */
const STATUS_RANK: Record<WindowStatus, number> = {
  open: 0,
  opening_soon: 1,
  locked: 2,
};

export function compareByUrgency(
  a: { windowsElapsed: number; nextWindowAt: Date; status: WindowStatus },
  b: { windowsElapsed: number; nextWindowAt: Date; status: WindowStatus },
): number {
  if (a.status !== b.status) {
    return STATUS_RANK[a.status] - STATUS_RANK[b.status];
  }
  if (a.status === 'open') {
    return b.windowsElapsed - a.windowsElapsed;
  }
  return a.nextWindowAt.getTime() - b.nextWindowAt.getTime();
}
