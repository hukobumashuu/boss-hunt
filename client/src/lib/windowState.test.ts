import { describe, expect, it } from "bun:test";
import type { TrackerEntry, WindowStatus } from "./types";
import {
  STALE_MISSED_THRESHOLD,
  computeWindowState,
  projectEntry,
  projectTracker,
} from "./windowState";

interface ContractCase {
  label: string;
  baseline: string;
  hours: number;
  now: string;
  status: WindowStatus;
  windowsElapsed: number;
  nextWindowAt: string;
}

const CONTRACT: ContractCase[] = [
  { label: "exactly at the kill", baseline: "2026-01-01T00:00:00.000Z", hours: 4, now: "2026-01-01T00:00:00.000Z", status: "locked", windowsElapsed: 0, nextWindowAt: "2026-01-01T04:00:00.000Z" },
  { label: "far before the first window", baseline: "2026-01-01T00:00:00.000Z", hours: 4, now: "2026-01-01T01:00:00.000Z", status: "locked", windowsElapsed: 0, nextWindowAt: "2026-01-01T04:00:00.000Z" },
  { label: "31 minutes before the first window", baseline: "2026-01-01T00:00:00.000Z", hours: 4, now: "2026-01-01T03:29:00.000Z", status: "locked", windowsElapsed: 0, nextWindowAt: "2026-01-01T04:00:00.000Z" },
  { label: "exactly 30 minutes before the first window", baseline: "2026-01-01T00:00:00.000Z", hours: 4, now: "2026-01-01T03:30:00.000Z", status: "opening_soon", windowsElapsed: 0, nextWindowAt: "2026-01-01T04:00:00.000Z" },
  { label: "1 ms before the first window", baseline: "2026-01-01T00:00:00.000Z", hours: 4, now: "2026-01-01T03:59:59.999Z", status: "opening_soon", windowsElapsed: 0, nextWindowAt: "2026-01-01T04:00:00.000Z" },
  { label: "exactly at the first window", baseline: "2026-01-01T00:00:00.000Z", hours: 4, now: "2026-01-01T04:00:00.000Z", status: "open", windowsElapsed: 0, nextWindowAt: "2026-01-01T04:00:00.000Z" },
  { label: "1 ms after the first window", baseline: "2026-01-01T00:00:00.000Z", hours: 4, now: "2026-01-01T04:00:00.001Z", status: "open", windowsElapsed: 0, nextWindowAt: "2026-01-01T04:00:00.000Z" },
  { label: "exactly at the end of the grace period", baseline: "2026-01-01T00:00:00.000Z", hours: 4, now: "2026-01-01T04:10:00.000Z", status: "open", windowsElapsed: 0, nextWindowAt: "2026-01-01T04:00:00.000Z" },
  { label: "1 ms after the grace period ends", baseline: "2026-01-01T00:00:00.000Z", hours: 4, now: "2026-01-01T04:10:00.001Z", status: "locked", windowsElapsed: 1, nextWindowAt: "2026-01-01T08:00:00.000Z" },
  { label: "rolled forward, far from the next window", baseline: "2026-01-01T00:00:00.000Z", hours: 4, now: "2026-01-01T04:11:00.000Z", status: "locked", windowsElapsed: 1, nextWindowAt: "2026-01-01T08:00:00.000Z" },
  { label: "rolled forward, 30 minutes before the next window", baseline: "2026-01-01T00:00:00.000Z", hours: 4, now: "2026-01-01T07:30:00.000Z", status: "opening_soon", windowsElapsed: 1, nextWindowAt: "2026-01-01T08:00:00.000Z" },
  { label: "rolled forward, 31 minutes before the next window", baseline: "2026-01-01T00:00:00.000Z", hours: 4, now: "2026-01-01T07:29:00.000Z", status: "locked", windowsElapsed: 1, nextWindowAt: "2026-01-01T08:00:00.000Z" },
  { label: "exactly at the second window", baseline: "2026-01-01T00:00:00.000Z", hours: 4, now: "2026-01-01T08:00:00.000Z", status: "open", windowsElapsed: 1, nextWindowAt: "2026-01-01T08:00:00.000Z" },
  { label: "4 windows missed", baseline: "2026-01-01T00:00:00.000Z", hours: 4, now: "2026-01-01T16:11:00.000Z", status: "locked", windowsElapsed: 4, nextWindowAt: "2026-01-01T20:00:00.000Z" },
  { label: "exactly 5 windows missed (stale)", baseline: "2026-01-01T00:00:00.000Z", hours: 4, now: "2026-01-01T20:11:00.000Z", status: "locked", windowsElapsed: 5, nextWindowAt: "2026-01-02T00:00:00.000Z" },
  { label: "open on the 10th window", baseline: "2026-01-01T00:00:00.000Z", hours: 4, now: "2026-01-02T16:05:00.000Z", status: "open", windowsElapsed: 9, nextWindowAt: "2026-01-02T16:00:00.000Z" },
  { label: "107 windows missed", baseline: "2026-01-01T00:00:00.000Z", hours: 4, now: "2026-01-18T20:30:00.000Z", status: "locked", windowsElapsed: 107, nextWindowAt: "2026-01-19T00:00:00.000Z" },
  { label: "now before the kill (clock skew)", baseline: "2026-01-01T00:00:00.000Z", hours: 4, now: "2025-12-31T23:00:00.000Z", status: "locked", windowsElapsed: 0, nextWindowAt: "2026-01-01T04:00:00.000Z" },
  { label: "now 1 ms before the kill", baseline: "2026-01-01T00:00:00.000Z", hours: 4, now: "2025-12-31T23:59:59.999Z", status: "locked", windowsElapsed: 0, nextWindowAt: "2026-01-01T04:00:00.000Z" },
  { label: "2.5 hour interval, at the window", baseline: "2026-01-01T00:00:00.000Z", hours: 2.5, now: "2026-01-01T02:30:00.000Z", status: "open", windowsElapsed: 0, nextWindowAt: "2026-01-01T02:30:00.000Z" },
  { label: "2.5 hour interval, in grace", baseline: "2026-01-01T00:00:00.000Z", hours: 2.5, now: "2026-01-01T02:33:00.000Z", status: "open", windowsElapsed: 0, nextWindowAt: "2026-01-01T02:30:00.000Z" },
  { label: "6 hour interval, opening soon after one miss", baseline: "2026-01-01T00:00:00.000Z", hours: 6, now: "2026-01-01T11:40:00.000Z", status: "opening_soon", windowsElapsed: 1, nextWindowAt: "2026-01-01T12:00:00.000Z" },
  { label: "24 hour interval, locked", baseline: "2026-01-01T00:00:00.000Z", hours: 24, now: "2026-01-01T05:00:00.000Z", status: "locked", windowsElapsed: 0, nextWindowAt: "2026-01-02T00:00:00.000Z" },
  { label: "1 hour interval, many windows", baseline: "2026-01-01T00:00:00.000Z", hours: 1, now: "2026-01-02T13:12:00.000Z", status: "locked", windowsElapsed: 37, nextWindowAt: "2026-01-02T14:00:00.000Z" },
  { label: "baseline with milliseconds, at the window", baseline: "2026-01-01T00:00:00.123Z", hours: 4, now: "2026-01-01T04:00:00.123Z", status: "open", windowsElapsed: 0, nextWindowAt: "2026-01-01T04:00:00.123Z" },
  { label: "baseline with milliseconds, 1 ms before the window", baseline: "2026-01-01T00:00:00.123Z", hours: 4, now: "2026-01-01T04:00:00.122Z", status: "opening_soon", windowsElapsed: 0, nextWindowAt: "2026-01-01T04:00:00.123Z" },
  { label: "baseline with milliseconds, after grace", baseline: "2026-01-01T00:00:00.123Z", hours: 4, now: "2026-01-01T04:10:00.124Z", status: "locked", windowsElapsed: 1, nextWindowAt: "2026-01-01T08:00:00.123Z" },
];

const MINUTE = 60_000;
const HOUR = 3_600_000;

function stateAt(c: ContractCase, nowMs: number) {
  return computeWindowState(Date.parse(c.baseline), c.hours, nowMs);
}

function snapshotOf(c: ContractCase): TrackerEntry {
  const state = stateAt(c, Date.parse(c.now));
  return {
    bossId: 1,
    bossName: "Cauda",
    map: "Map",
    channel: 7,
    lastKilledAt: c.baseline,
    nextWindowAt: new Date(state.nextWindowMs).toISOString(),
    windowsElapsed: state.windowsElapsed,
    isStale: state.windowsElapsed >= STALE_MISSED_THRESHOLD,
    status: state.status,
    respawnIntervalHours: c.hours,
  };
}

const entry = (over: Partial<TrackerEntry>): TrackerEntry => ({
  bossId: 1,
  bossName: "Cauda",
  map: "Map",
  channel: 1,
  lastKilledAt: "2026-01-01T00:00:00.000Z",
  nextWindowAt: "2026-01-01T04:00:00.000Z",
  windowsElapsed: 0,
  isStale: false,
  status: "locked",
  respawnIntervalHours: 4,
  ...over,
});

describe("status rules contract (same cases as the server)", () => {
  for (const c of CONTRACT) {
    it(c.label, () => {
      const state = stateAt(c, Date.parse(c.now));

      expect(state.status).toBe(c.status);
      expect(state.windowsElapsed).toBe(c.windowsElapsed);
      expect(new Date(state.nextWindowMs).toISOString()).toBe(c.nextWindowAt);
    });
  }

  it("rejects a non-positive interval", () => {
    expect(() => computeWindowState(0, 0, 0)).toThrow();
    expect(() => computeWindowState(0, -4, 0)).toThrow();
  });
});

describe("projectEntry", () => {
  const LATER_BY = [0, 1, 1_000, 5 * MINUTE, 4 * HOUR, 25 * HOUR, 40 * 24 * HOUR];

  it("gives the same answer as computing from the original baseline, at any later time", () => {
    for (const c of CONTRACT) {
      const snapshot = snapshotOf(c);
      for (const later of LATER_BY) {
        const nowMs = Date.parse(c.now) + later;
        const expected = stateAt(c, nowMs);

        const projected = projectEntry(snapshot, nowMs);

        expect(projected.status).toBe(expected.status);
        expect(projected.windowsElapsed).toBe(expected.windowsElapsed);
        expect(projected.nextWindowAt).toBe(new Date(expected.nextWindowMs).toISOString());
      }
    }
  });

  it("flips a row to open exactly at its check time, keeps it open for the grace period, then rolls it forward", () => {
    const row = entry({});
    const at = Date.parse(row.nextWindowAt);

    expect(projectEntry(row, at - 31 * MINUTE).status).toBe("locked");
    expect(projectEntry(row, at - 30 * MINUTE).status).toBe("opening_soon");
    expect(projectEntry(row, at - 1).status).toBe("opening_soon");
    expect(projectEntry(row, at).status).toBe("open");
    expect(projectEntry(row, at + 10 * MINUTE).status).toBe("open");

    const rolled = projectEntry(row, at + 10 * MINUTE + 1);
    expect(rolled.windowsElapsed).toBe(1);
    expect(rolled.nextWindowAt).toBe("2026-01-01T08:00:00.000Z");
    expect(rolled.status).toBe("locked");
  });

  it("marks a row stale once its fifth window is missed, and not before", () => {
    const row = entry({});
    const at = Date.parse(row.nextWindowAt);
    const afterGrace = (windows: number) => at + windows * 4 * HOUR + 10 * MINUTE + 1;

    expect(projectEntry(row, afterGrace(3)).isStale).toBe(false);
    expect(projectEntry(row, afterGrace(4)).windowsElapsed).toBe(5);
    expect(projectEntry(row, afterGrace(4)).isStale).toBe(true);
  });

  it("keeps a maintenance-reset baseline, because the baseline comes from the row", () => {
    const row = entry({
      lastKilledAt: "2025-12-25T00:00:00.000Z",
      nextWindowAt: "2026-01-01T12:00:00.000Z",
    });
    const at = Date.parse(row.nextWindowAt);

    expect(projectEntry(row, at - 1).status).toBe("opening_soon");
    expect(projectEntry(row, at).status).toBe("open");
    expect(projectEntry(row, at).lastKilledAt).toBe("2025-12-25T00:00:00.000Z");
  });

  it("changes only status, windowsElapsed, nextWindowAt and isStale", () => {
    const row = entry({ bossName: "Karion", map: "Somewhere", channel: 12 });

    const projected = projectEntry(row, Date.parse(row.nextWindowAt) + HOUR);

    expect({ ...projected, status: 0, windowsElapsed: 0, nextWindowAt: "", isStale: false }).toEqual({
      ...row,
      status: 0,
      windowsElapsed: 0,
      nextWindowAt: "",
      isStale: false,
    });
  });

  it("leaves a row untouched when its data is unusable instead of crashing", () => {
    const bad = [
      entry({ nextWindowAt: "not a date" }),
      entry({ respawnIntervalHours: 0 }),
      entry({ respawnIntervalHours: -4 }),
      entry({ windowsElapsed: Number.NaN }),
      entry({ windowsElapsed: -1 }),
    ];

    for (const row of bad) {
      expect(projectEntry(row, Date.parse("2026-06-01T00:00:00.000Z"))).toBe(row);
    }
  });
});

describe("projectTracker", () => {
  it("sorts by next check time, then channel", () => {
    const rows = [
      entry({ channel: 9, nextWindowAt: "2026-01-01T06:00:00.000Z" }),
      entry({ channel: 3, nextWindowAt: "2026-01-01T04:00:00.000Z" }),
      entry({ channel: 2, nextWindowAt: "2026-01-01T04:00:00.000Z" }),
    ];

    const result = projectTracker(rows, Date.parse("2026-01-01T00:00:00.000Z"));

    expect(result.map((r) => r.channel)).toEqual([2, 3, 9]);
  });

  it("re-orders a row that has just missed its window, moving it behind later rows", () => {
    const rows = [
      entry({ channel: 1, nextWindowAt: "2026-01-01T04:00:00.000Z" }),
      entry({ channel: 2, nextWindowAt: "2026-01-01T06:00:00.000Z" }),
    ];

    const duringGrace = projectTracker(rows, Date.parse("2026-01-01T04:05:00.000Z"));
    const afterGrace = projectTracker(rows, Date.parse("2026-01-01T04:10:00.001Z"));

    expect(duringGrace.map((r) => r.channel)).toEqual([1, 2]);
    expect(afterGrace.map((r) => r.channel)).toEqual([2, 1]);
  });

  it("does not modify the list it was given", () => {
    const rows = [entry({ channel: 2 }), entry({ channel: 1 })];
    const copy = structuredClone(rows);

    projectTracker(rows, Date.parse("2027-01-01T00:00:00.000Z"));

    expect(rows).toEqual(copy);
  });

  it("puts an unusable row last without breaking the sort", () => {
    const rows = [
      entry({ channel: 5, nextWindowAt: "garbage" }),
      entry({ channel: 1, nextWindowAt: "2026-01-01T04:00:00.000Z" }),
    ];

    const result = projectTracker(rows, Date.parse("2026-01-01T00:00:00.000Z"));

    expect(result.map((r) => r.channel)).toEqual([1, 5]);
  });
});
