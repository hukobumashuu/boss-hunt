import type { TrackerEntry, WindowStatus } from "./types";

const OPENING_SOON_THRESHOLD_MINUTES = 30;
const GRACE_PERIOD_MS = 10 * 60 * 1000;
export const STALE_MISSED_THRESHOLD = 5;

export interface WindowState {
  windowsElapsed: number;
  nextWindowMs: number;
  status: WindowStatus;
}

function deriveApproachStatus(nextWindowMs: number, nowMs: number): WindowStatus {
  const minutesUntilNext = (nextWindowMs - nowMs) / 60_000;
  return minutesUntilNext <= OPENING_SOON_THRESHOLD_MINUTES
    ? "opening_soon"
    : "locked";
}

export function computeWindowState(
  baselineMs: number,
  respawnIntervalHours: number,
  nowMs: number,
): WindowState {
  if (respawnIntervalHours <= 0) {
    throw new Error("respawnIntervalHours must be positive");
  }

  const intervalMs = respawnIntervalHours * 60 * 60 * 1000;
  const elapsedMs = Math.max(0, nowMs - baselineMs);
  const ticksPassed = Math.floor(elapsedMs / intervalMs);
  const msIntoCurrentTick = elapsedMs - ticksPassed * intervalMs;

  if (ticksPassed === 0) {
    const nextWindowMs = baselineMs + intervalMs;
    return {
      windowsElapsed: 0,
      nextWindowMs,
      status: deriveApproachStatus(nextWindowMs, nowMs),
    };
  }

  if (msIntoCurrentTick <= GRACE_PERIOD_MS) {
    return {
      windowsElapsed: ticksPassed - 1,
      nextWindowMs: baselineMs + ticksPassed * intervalMs,
      status: "open",
    };
  }

  const nextWindowMs = baselineMs + (ticksPassed + 1) * intervalMs;
  return {
    windowsElapsed: ticksPassed,
    nextWindowMs,
    status: deriveApproachStatus(nextWindowMs, nowMs),
  };
}

export function projectEntry(entry: TrackerEntry, nowMs: number): TrackerEntry {
  const nextWindowMs = Date.parse(entry.nextWindowAt);
  const intervalMs = entry.respawnIntervalHours * 60 * 60 * 1000;
  if (
    Number.isNaN(nextWindowMs) ||
    !(intervalMs > 0) ||
    !Number.isFinite(entry.windowsElapsed) ||
    entry.windowsElapsed < 0
  ) {
    return entry;
  }

  const baselineMs = nextWindowMs - (entry.windowsElapsed + 1) * intervalMs;
  const state = computeWindowState(baselineMs, entry.respawnIntervalHours, nowMs);

  return {
    ...entry,
    status: state.status,
    windowsElapsed: state.windowsElapsed,
    nextWindowAt: new Date(state.nextWindowMs).toISOString(),
    isStale: state.windowsElapsed >= STALE_MISSED_THRESHOLD,
  };
}

function nextWindowOf(entry: TrackerEntry): number {
  const ms = Date.parse(entry.nextWindowAt);
  return Number.isNaN(ms) ? Number.MAX_SAFE_INTEGER : ms;
}

export function projectTracker(
  entries: readonly TrackerEntry[],
  nowMs: number,
): TrackerEntry[] {
  return entries
    .map((entry) => projectEntry(entry, nowMs))
    .sort((a, b) => {
      const diff = nextWindowOf(a) - nextWindowOf(b);
      return diff !== 0 ? diff : a.channel - b.channel;
    });
}
