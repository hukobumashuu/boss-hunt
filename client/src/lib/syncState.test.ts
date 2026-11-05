import { describe, expect, it } from "bun:test";
import { MAX_KILL_AGE_MS } from "./killIntent";
import { describeKillProgress, describeSyncState } from "./syncState";
import type { SyncInput } from "./syncState";
import { formatAge, formatTimeOfDay } from "./time";

const NOW = 1_800_000_000_000;
const UPDATED = NOW - 5_000;

const base: SyncInput = {
  isOnline: true,
  hasData: true,
  isFetching: false,
  isError: false,
  failureCount: 0,
  dataUpdatedAt: UPDATED,
  nowMs: NOW,
};
const at = (overrides: Partial<SyncInput>) => describeSyncState({ ...base, ...overrides });
const time = formatTimeOfDay(new Date(UPDATED).toISOString());

describe("describeSyncState when online", () => {
  it("shows when the data was synced", () => {
    expect(at({})).toEqual({ tone: "muted", showRetry: false, message: `Synced ${time}` });
  });

  it("says it is loading before any data arrives", () => {
    expect(at({ hasData: false, dataUpdatedAt: 0 }).message).toBe("Loading tracker...");
  });

  it("says the server is waking up once the first attempts have failed", () => {
    const state = at({ hasData: false, dataUpdatedAt: 0, failureCount: 1 });

    expect(state.tone).toBe("warn");
    expect(state.message).toContain("waking up");
    expect(state.message).toContain("attempt 2 of 3");
  });

  it("offers a retry when the server cannot be reached, with or without saved data", () => {
    const withData = at({ isError: true });
    const withoutData = at({ isError: true, hasData: false, dataUpdatedAt: 0 });

    expect(withData).toMatchObject({ tone: "error", showRetry: true });
    expect(withData.message).toContain("Can't reach the server.");
    expect(withData.message).toContain(`Showing data from ${time} (${formatAge(5_000)})`);
    expect(withoutData).toMatchObject({ tone: "error", showRetry: true });
    expect(withoutData.message).toBe("Couldn't reach the server.");
  });

  it("reports a slow server while retrying", () => {
    const state = at({ isFetching: true, failureCount: 1 });

    expect(state.tone).toBe("warn");
    expect(state.message).toContain("slow to respond");
    expect(state.message).toContain("attempt 2 of 3");
  });

  it("calls out old data only while a refresh is running and the data is noticeably old", () => {
    const old = { dataUpdatedAt: NOW - 120_000, isFetching: true };

    expect(at(old).message).toContain("Updating...");
    expect(at({ ...old, dataUpdatedAt: NOW - 30_000 }).message).toStartWith("Synced");
    expect(at({ dataUpdatedAt: NOW - 120_000 }).message).toStartWith("Synced");
  });
});

describe("describeSyncState when the browser is offline", () => {
  it("explains the data is saved and kills will send later", () => {
    const state = at({ isOnline: false });

    expect(state).toMatchObject({ tone: "warn", showRetry: false });
    expect(state.message).toContain("You're offline.");
    expect(state.message).toContain(`Showing data from ${time}`);
    expect(state.message).toContain("Kills you log will send when you're back online.");
  });

  it("says the tracker will load later when there is nothing saved", () => {
    expect(at({ isOnline: false, hasData: false, dataUpdatedAt: 0 }).message).toBe(
      "You're offline. The tracker will load when you're back online.",
    );
  });

  it("takes priority over an earlier error, a retry or the loading state", () => {
    for (const overrides of [
      { isError: true },
      { isFetching: true, failureCount: 2 },
      { hasData: false, dataUpdatedAt: 0 },
    ]) {
      const state = at({ isOnline: false, ...overrides });

      expect(state.message).toContain("You're offline.");
      expect(state.showRetry).toBe(false);
    }
  });
});

describe("describeKillProgress", () => {
  it("shows a normal button when nothing is in flight", () => {
    expect(describeKillProgress({ isPending: false, isPaused: false, failureCount: 0 })).toEqual({
      buttonLabel: "Log kill",
      note: null,
      waiting: false,
    });
  });

  it("shows logging, then retrying, while a request is in flight", () => {
    expect(describeKillProgress({ isPending: true, isPaused: false, failureCount: 0 })).toEqual({
      buttonLabel: "Logging…",
      note: "Logging...",
      waiting: false,
    });
    expect(describeKillProgress({ isPending: true, isPaused: false, failureCount: 1 })).toMatchObject({
      buttonLabel: "Retrying…",
      waiting: false,
    });
  });

  it("says a kill is waiting for the connection and how long its time is kept", () => {
    const progress = describeKillProgress({ isPending: true, isPaused: true, failureCount: 0 });

    expect(progress.buttonLabel).toBe("Waiting…");
    expect(progress.waiting).toBe(true);
    expect(progress.note).toContain("Waiting for connection.");
    expect(progress.note).toContain(`${MAX_KILL_AGE_MS / 60_000} minutes`);
  });

  it("shows waiting rather than retrying when the connection drops mid-retry", () => {
    expect(describeKillProgress({ isPending: true, isPaused: true, failureCount: 2 }).waiting).toBe(true);
  });

  it("ignores the paused flag when nothing is pending", () => {
    expect(describeKillProgress({ isPending: false, isPaused: true, failureCount: 0 }).waiting).toBe(false);
  });
});
