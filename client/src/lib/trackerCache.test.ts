import { describe, expect, it } from "bun:test";
import type { TrackerEntry } from "./types";
import {
  MAX_CACHE_AGE_MS,
  clearCachedTracker,
  loadCachedTracker,
  saveCachedTracker,
} from "./trackerCache";

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    raw: data,
  };
}

const entry: TrackerEntry = {
  bossId: 1,
  bossName: "Cauda",
  map: "Map",
  channel: 26,
  lastKilledAt: "2026-10-06T10:00:00.000Z",
  nextWindowAt: "2026-10-06T14:00:00.000Z",
  windowsElapsed: 1,
  isStale: false,
  status: "locked",
  respawnIntervalHours: 4,
};
const NOW = 1_800_000_000_000;

describe("tracker cache", () => {
  it("round-trips entries and the time they were saved", () => {
    const storage = fakeStorage();
    saveCachedTracker([entry], NOW - 5_000, storage);

    expect(loadCachedTracker(NOW, storage)).toEqual({
      savedAt: NOW - 5_000,
      entries: [entry],
    });
  });

  it("returns null when nothing is saved", () => {
    expect(loadCachedTracker(NOW, fakeStorage())).toBeNull();
  });

  it("ignores data older than the maximum age", () => {
    const storage = fakeStorage();
    saveCachedTracker([entry], NOW - MAX_CACHE_AGE_MS - 1, storage);

    expect(loadCachedTracker(NOW, storage)).toBeNull();
  });

  it("ignores data saved in the future (clock moved backwards)", () => {
    const storage = fakeStorage();
    saveCachedTracker([entry], NOW + 10 * 60_000, storage);

    expect(loadCachedTracker(NOW, storage)).toBeNull();
  });

  it("rejects corrupt JSON, wrong shapes and entries with bad fields", () => {
    const key = "boss-tracker-cache-v1";
    const bad = [
      "{not json",
      "null",
      JSON.stringify({ savedAt: "x", entries: [] }),
      JSON.stringify({ savedAt: NOW, entries: "nope" }),
      JSON.stringify({ savedAt: NOW, entries: [{ ...entry, status: "weird" }] }),
      JSON.stringify({ savedAt: NOW, entries: [{ ...entry, channel: "26" }] }),
      JSON.stringify({ savedAt: NOW, entries: [null] }),
    ];

    for (const value of bad) {
      expect(loadCachedTracker(NOW, fakeStorage({ [key]: value }))).toBeNull();
    }
  });

  it("clears the saved tracker", () => {
    const storage = fakeStorage();
    saveCachedTracker([entry], NOW, storage);
    clearCachedTracker(storage);

    expect(loadCachedTracker(NOW, storage)).toBeNull();
  });

  it("never throws when storage is unavailable or full", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };

    expect(() => saveCachedTracker([entry], NOW, broken)).not.toThrow();
    expect(loadCachedTracker(NOW, broken)).toBeNull();
    expect(() => clearCachedTracker(broken)).not.toThrow();
  });
});
