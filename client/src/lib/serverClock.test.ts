import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  estimateOffset,
  getServerOffset,
  loadServerOffset,
  recordClockSample,
  resetServerClock,
  serverNow,
} from "./serverClock";

const SECOND = Date.UTC(2026, 0, 1, 0, 0, 10);
const HEADER = new Date(SECOND).toUTCString();

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    raw: data,
  };
}

function sampleFor(offsetMs: number, roundTripMs = 100) {
  const sentAt = SECOND + 500 - offsetMs - roundTripMs / 2;
  return { dateHeader: HEADER, sentAt, receivedAt: sentAt + roundTripMs };
}

beforeEach(resetServerClock);
afterEach(resetServerClock);

describe("estimateOffset", () => {
  it("is zero when the clocks agree, allowing for the header's whole-second resolution", () => {
    expect(
      estimateOffset({ dateHeader: HEADER, sentAt: SECOND + 400, receivedAt: SECOND + 600 }),
    ).toBe(0);
  });

  it("reports how far the browser clock is behind or ahead of the server", () => {
    expect(estimateOffset(sampleFor(90_000))).toBe(90_000);
    expect(estimateOffset(sampleFor(-45_000))).toBe(-45_000);
  });

  it("splits the round trip evenly between request and response", () => {
    expect(estimateOffset(sampleFor(2_000, 1_000))).toBe(2_000);
  });

  it("rejects a missing or unreadable header", () => {
    expect(estimateOffset({ dateHeader: null, sentAt: 0, receivedAt: 100 })).toBeNull();
    expect(estimateOffset({ dateHeader: "not a date", sentAt: 0, receivedAt: 100 })).toBeNull();
  });

  it("rejects slow responses, such as a server waking up, and impossible timings", () => {
    expect(estimateOffset(sampleFor(0, 5_001))).toBeNull();
    expect(estimateOffset(sampleFor(0, 5_000))).toBe(0);
    expect(estimateOffset({ dateHeader: HEADER, sentAt: 1_000, receivedAt: 900 })).toBeNull();
  });

  it("rejects an offset of more than a day, which means a bad header rather than a bad clock", () => {
    expect(estimateOffset(sampleFor(25 * 60 * 60 * 1000))).toBeNull();
  });
});

describe("recordClockSample", () => {
  it("uses the median of recent samples, so one odd sample cannot move the clock", () => {
    const storage = fakeStorage();

    for (const offset of [1_000, 1_020, 60_000, 990, 1_010]) {
      recordClockSample(sampleFor(offset), storage, 0);
    }

    expect(getServerOffset()).toBe(1_010);
  });

  it("follows the newest samples once old ones age out of the window", () => {
    const storage = fakeStorage();

    for (const offset of [1_000, 1_000, 1_000, 5_000, 5_000, 5_000, 5_000]) {
      recordClockSample(sampleFor(offset), storage, 0);
    }

    expect(getServerOffset()).toBe(5_000);
  });

  it("ignores unusable samples", () => {
    const storage = fakeStorage();

    recordClockSample({ dateHeader: null, sentAt: 0, receivedAt: 10 }, storage, 0);
    recordClockSample(sampleFor(0, 9_000), storage, 0);

    expect(getServerOffset()).toBe(0);
    expect(storage.raw.size).toBe(0);
  });

  it("never throws when storage is full or unavailable", () => {
    const broken = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => undefined,
    };

    expect(() => recordClockSample(sampleFor(1_234), broken, 0)).not.toThrow();
    expect(getServerOffset()).toBe(1_234);
  });
});

describe("serverNow", () => {
  it("adds the measured offset to the browser clock", () => {
    recordClockSample(sampleFor(90_000), fakeStorage(), 0);

    expect(serverNow(1_000_000)).toBe(1_090_000);
  });

  it("equals the browser clock before any sample arrives", () => {
    expect(serverNow(1_000_000)).toBe(1_000_000);
  });
});

describe("loadServerOffset", () => {
  it("restores the last offset so the first screen after a reload is already corrected", () => {
    const storage = fakeStorage();
    recordClockSample(sampleFor(7_000), storage, 1_000);
    resetServerClock();

    loadServerOffset(storage, 2_000);

    expect(getServerOffset()).toBe(7_000);
  });

  it("is replaced by the first live sample, not averaged with it", () => {
    const storage = fakeStorage();
    recordClockSample(sampleFor(7_000), storage, 1_000);
    resetServerClock();
    loadServerOffset(storage, 2_000);

    recordClockSample(sampleFor(1_000), storage, 3_000);

    expect(getServerOffset()).toBe(1_000);
  });

  it("ignores an offset that is more than a day old", () => {
    const storage = fakeStorage();
    recordClockSample(sampleFor(7_000), storage, 0);
    resetServerClock();

    loadServerOffset(storage, 25 * 60 * 60 * 1000);

    expect(getServerOffset()).toBe(0);
  });

  it("ignores corrupt or out-of-range values", () => {
    const key = "boss-tracker-clock-offset-v1";
    for (const value of [
      "{oops",
      "null",
      JSON.stringify({ offsetMs: "7", savedAt: 0 }),
      JSON.stringify({ offsetMs: 7_000 }),
      JSON.stringify({ offsetMs: 999_999_999_999, savedAt: 0 }),
      JSON.stringify({ offsetMs: 7_000, savedAt: 10 * 60_000 }),
    ]) {
      resetServerClock();
      loadServerOffset(fakeStorage({ [key]: value }), 0);
      expect(getServerOffset()).toBe(0);
    }
  });

  it("never throws when storage is unavailable", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    };

    expect(() => loadServerOffset(broken, 0)).not.toThrow();
  });
});
