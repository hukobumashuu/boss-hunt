const STORAGE_KEY = "boss-tracker-clock-offset-v1";
const MAX_ROUND_TRIP_MS = 5_000;
const MAX_ABS_OFFSET_MS = 24 * 60 * 60 * 1000;
const MAX_SAVED_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_SAMPLES = 5;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface ClockSample {
  dateHeader: string | null;
  sentAt: number;
  receivedAt: number;
}

export function estimateOffset(sample: ClockSample): number | null {
  if (!sample.dateHeader) return null;
  const serverMs = Date.parse(sample.dateHeader);
  if (Number.isNaN(serverMs)) return null;

  const roundTripMs = sample.receivedAt - sample.sentAt;
  if (roundTripMs < 0 || roundTripMs > MAX_ROUND_TRIP_MS) return null;

  const midpoint = sample.sentAt + roundTripMs / 2;
  const offset = Math.round(serverMs + 500 - midpoint);
  return Math.abs(offset) > MAX_ABS_OFFSET_MS ? null : offset;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
  return Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2);
}

let samples: number[] = [];
let offsetMs = 0;

export function getServerOffset(): number {
  return offsetMs;
}

export function serverNow(nowMs: number = Date.now()): number {
  return nowMs + offsetMs;
}

export function recordClockSample(
  sample: ClockSample,
  storage: StorageLike = localStorage,
  nowMs: number = Date.now(),
): void {
  const estimate = estimateOffset(sample);
  if (estimate === null) return;

  samples = [...samples, estimate].slice(-MAX_SAMPLES);
  offsetMs = median(samples);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ offsetMs, savedAt: nowMs }));
  } catch {
    return;
  }
}

export function loadServerOffset(
  storage: StorageLike = localStorage,
  nowMs: number = Date.now(),
): void {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return;

    const saved = (parsed as Record<string, unknown>)["offsetMs"];
    const savedAt = (parsed as Record<string, unknown>)["savedAt"];
    if (typeof saved !== "number" || typeof savedAt !== "number") return;
    if (!Number.isFinite(saved) || Math.abs(saved) > MAX_ABS_OFFSET_MS) return;
    if (nowMs - savedAt > MAX_SAVED_AGE_MS || savedAt > nowMs + 60_000) return;

    offsetMs = saved;
  } catch {
    return;
  }
}

export function resetServerClock(): void {
  samples = [];
  offsetMs = 0;
}
