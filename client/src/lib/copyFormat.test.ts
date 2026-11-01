import { describe, expect, it } from "bun:test";
import { formatCopyText } from "./copyFormat";
import { formatTimeOfDay } from "./time";
import type { TrackerEntry } from "./types";

const entry = (over: Partial<TrackerEntry>): TrackerEntry => ({
  bossId: 1,
  bossName: "Cauda",
  map: "Map",
  channel: 26,
  lastKilledAt: "2026-10-06T10:00:00.000Z",
  nextWindowAt: "2026-10-06T14:00:00.000Z",
  windowsElapsed: 0,
  isStale: false,
  status: "locked",
  respawnIntervalHours: 4,
  ...over,
});

describe("formatCopyText", () => {
  it("labels the header with when the data was synced, not the current time", () => {
    const syncedAt = new Date("2026-10-06T09:41:15.000Z");
    const text = formatCopyText([entry({})], syncedAt);

    expect(text.split("\n")[0]).toBe(
      `Boss Tracker - synced ${formatTimeOfDay(syncedAt.toISOString())}`,
    );
  });

  it("lists boss letter, channel, time and missed windows, skipping stale rows", () => {
    const text = formatCopyText(
      [entry({ windowsElapsed: 2 }), entry({ channel: 9, isStale: true })],
      new Date("2026-10-06T09:41:15.000Z"),
    );
    const lines = text.split("\n");

    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/^S 26 .+ x2$/);
  });
});
