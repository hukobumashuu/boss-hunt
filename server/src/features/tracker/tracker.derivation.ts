export type WindowStatus = 'locked' | 'opening_soon' | 'open';

export interface WindowState {
  windowsElapsed: number;
  nextWindowAt: Date;
  status: WindowStatus;
}

const OPENING_SOON_THRESHOLD_MINUTES = 30;
const GRACE_PERIOD_MINUTES = 10;
const GRACE_PERIOD_MS = GRACE_PERIOD_MINUTES * 60 * 1000;
export const STALE_MISSED_THRESHOLD = 5;

export function isStaleWindow(windowsElapsed: number): boolean {
  return windowsElapsed >= STALE_MISSED_THRESHOLD;
}

export function computeWindowState(
  lastKilledAt: Date,
  respawnIntervalHours: number,
  now: Date = new Date(),
): WindowState {
  if (respawnIntervalHours <= 0) {
    throw new Error('respawnIntervalHours must be positive');
  }

  const intervalMs = respawnIntervalHours * 60 * 60 * 1000;

  const elapsedMs = Math.max(0, now.getTime() - lastKilledAt.getTime());
  const ticksPassed = Math.floor(elapsedMs / intervalMs);
  const msIntoCurrentTick = elapsedMs - ticksPassed * intervalMs;

  if (ticksPassed === 0) {
    const nextWindowAt = new Date(lastKilledAt.getTime() + intervalMs);
    return {
      windowsElapsed: 0,
      nextWindowAt,
      status: deriveApproachStatus(nextWindowAt, now),
    };
  }

  if (msIntoCurrentTick <= GRACE_PERIOD_MS) {
    const nextWindowAt = new Date(
      lastKilledAt.getTime() + ticksPassed * intervalMs,
    );
    return {
      windowsElapsed: ticksPassed - 1,
      nextWindowAt,
      status: 'open',
    };
  }

  const nextWindowAt = new Date(
    lastKilledAt.getTime() + (ticksPassed + 1) * intervalMs,
  );
  return {
    windowsElapsed: ticksPassed,
    nextWindowAt,
    status: deriveApproachStatus(nextWindowAt, now),
  };
}

function deriveApproachStatus(nextWindowAt: Date, now: Date): WindowStatus {
  const minutesUntilNext = (nextWindowAt.getTime() - now.getTime()) / 60_000;
  return minutesUntilNext <= OPENING_SOON_THRESHOLD_MINUTES
    ? 'opening_soon'
    : 'locked';
}

export function effectiveLastKilledAt(
  realLastKilledAt: Date,
  respawnIntervalHours: number,
  latestResetAt: Date | null,
): Date {
  if (!latestResetAt || latestResetAt <= realLastKilledAt) {
    return realLastKilledAt;
  }
  const intervalMs = respawnIntervalHours * 60 * 60 * 1000;
  return new Date(latestResetAt.getTime() - intervalMs);
}

export function compareByUrgency(
  a: { nextWindowAt: Date; channel: number },
  b: { nextWindowAt: Date; channel: number },
): number {
  const diff = a.nextWindowAt.getTime() - b.nextWindowAt.getTime();
  if (diff !== 0) return diff;
  return a.channel - b.channel;
}
