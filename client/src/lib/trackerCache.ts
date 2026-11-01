import type { TrackerEntry, WindowStatus } from "./types";

const STORAGE_KEY = "boss-tracker-cache-v1";

// Saved data is only a stand-in until the first real response arrives, and
// statuses drift as time passes, so don't resurrect anything very old.
export const MAX_CACHE_AGE_MS = 2 * 60 * 60 * 1000;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface CachedTracker {
  savedAt: number;
  entries: TrackerEntry[];
}

const STATUSES: readonly WindowStatus[] = ["locked", "opening_soon", "open"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTrackerEntry(value: unknown): value is TrackerEntry {
  return (
    isRecord(value) &&
    typeof value["bossId"] === "number" &&
    typeof value["bossName"] === "string" &&
    typeof value["map"] === "string" &&
    typeof value["channel"] === "number" &&
    typeof value["lastKilledAt"] === "string" &&
    typeof value["nextWindowAt"] === "string" &&
    typeof value["windowsElapsed"] === "number" &&
    typeof value["isStale"] === "boolean" &&
    typeof value["respawnIntervalHours"] === "number" &&
    STATUSES.includes(value["status"] as WindowStatus)
  );
}

/** Returns null for anything missing, expired, corrupt or from another shape. */
export function loadCachedTracker(
  now: number = Date.now(),
  storage: StorageLike = localStorage,
): CachedTracker | null {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;

    const savedAt = parsed["savedAt"];
    const entries = parsed["entries"];
    if (typeof savedAt !== "number" || !Array.isArray(entries)) return null;
    if (now - savedAt > MAX_CACHE_AGE_MS) return null;
    if (savedAt > now + 60_000) return null; // clock moved backwards
    if (!entries.every(isTrackerEntry)) return null;

    return { savedAt, entries };
  } catch {
    return null;
  }
}

export function saveCachedTracker(
  entries: TrackerEntry[],
  savedAt: number = Date.now(),
  storage: StorageLike = localStorage,
): void {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ savedAt, entries }));
  } catch {
    // Best effort: storage can be full or disabled (private mode).
  }
}

export function clearCachedTracker(storage: StorageLike = localStorage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing useful to do if storage is unavailable.
  }
}
