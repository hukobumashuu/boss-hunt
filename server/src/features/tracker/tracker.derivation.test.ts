import { describe, it, expect } from 'bun:test';
import { computeWindowState, compareByUrgency } from './tracker.derivation';

const HOUR = 60 * 60 * 1000;
const MIN = 60 * 1000;

describe('computeWindowState', () => {
  it('is locked well before the first window', () => {
    const killedAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-01T02:00:00Z');
    const state = computeWindowState(killedAt, 4, now);

    expect(state.status).toBe('locked');
    expect(state.windowsElapsed).toBe(0);
    expect(state.nextWindowAt).toEqual(new Date('2026-01-01T04:00:00Z'));
  });

  it('flips to opening_soon inside the threshold before the first window', () => {
    const killedAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-01T03:45:00Z');
    const state = computeWindowState(killedAt, 4, now);

    expect(state.status).toBe('opening_soon');
    expect(state.windowsElapsed).toBe(0);
  });

  it('flips to open the instant the first window boundary passes, with nothing confirmed missed yet', () => {
    const killedAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date(killedAt.getTime() + 4 * HOUR + 1);
    const state = computeWindowState(killedAt, 4, now);

    expect(state.status).toBe('open');
    expect(state.windowsElapsed).toBe(0);
    expect(state.nextWindowAt).toEqual(new Date(killedAt.getTime() + 4 * HOUR));
  });

  it('stays open for the whole grace period, still anchored at the boundary', () => {
    const killedAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date(killedAt.getTime() + 4 * HOUR + 9 * MIN);
    const state = computeWindowState(killedAt, 4, now);

    expect(state.status).toBe('open');
    expect(state.windowsElapsed).toBe(0);
    expect(state.nextWindowAt).toEqual(new Date(killedAt.getTime() + 4 * HOUR));
  });

  it("bumps windowsElapsed to 1 only once this boundary's own grace period expires", () => {
    const killedAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date(killedAt.getTime() + 4 * HOUR + 11 * MIN);
    const state = computeWindowState(killedAt, 4, now);

    expect(state.status).toBe('locked');
    expect(state.windowsElapsed).toBe(1);
    expect(state.nextWindowAt).toEqual(new Date(killedAt.getTime() + 8 * HOUR));
  });

  it('keeps rolling forward correctly across multiple missed windows', () => {
    const killedAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date(killedAt.getTime() + 8 * HOUR + 15 * MIN);
    const state = computeWindowState(killedAt, 4, now);

    expect(state.status).toBe('locked');
    expect(state.windowsElapsed).toBe(2);
    expect(state.nextWindowAt).toEqual(
      new Date(killedAt.getTime() + 12 * HOUR),
    );
  });

  it('shows opening_soon once close to a rolled-forward boundary', () => {
    const killedAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date(killedAt.getTime() + 8 * HOUR - 20 * MIN);
    const state = computeWindowState(killedAt, 4, now);

    expect(state.status).toBe('opening_soon');
    expect(state.windowsElapsed).toBe(1);
    expect(state.nextWindowAt).toEqual(new Date(killedAt.getTime() + 8 * HOUR));
  });

  it('treats clock skew (now before killedAt) as windowsElapsed 0, not negative', () => {
    const killedAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2025-12-31T23:00:00Z');
    const state = computeWindowState(killedAt, 4, now);

    expect(state.windowsElapsed).toBe(0);
    expect(state.status).not.toBe('open');
  });

  it('rejects a non-positive interval', () => {
    expect(() => computeWindowState(new Date(), 0, new Date())).toThrow();
  });
});

describe('compareByUrgency', () => {
  it('sorts purely by nextWindowAt, ignoring status entirely', () => {
    const openButLate = {
      nextWindowAt: new Date('2026-01-01T10:00:00Z'),
      channel: 19,
      status: 'open' as const,
    };
    const lockedButSoon = {
      nextWindowAt: new Date('2026-01-01T06:35:00Z'),
      channel: 5,
      status: 'locked' as const,
    };

    const sorted = [openButLate, lockedButSoon].sort(compareByUrgency);
    expect(sorted[0]).toBe(lockedButSoon);
  });

  it('puts a missed-then-rolled-forward channel right next to a freshly killed one landing on the same boundary', () => {
    const ch4RolledForward = {
      nextWindowAt: new Date('2026-01-01T22:27:00Z'),
      channel: 4,
    };
    const ch5FreshKill = {
      nextWindowAt: new Date('2026-01-01T22:27:00Z'),
      channel: 5,
    };

    const sorted = [ch5FreshKill, ch4RolledForward].sort(compareByUrgency);
    expect(sorted.map((s) => s.channel)).toEqual([4, 5]);
  });

  it('breaks exact ties by channel number ascending', () => {
    const same = new Date('2026-01-01T00:00:00Z');
    const a = { nextWindowAt: same, channel: 12 };
    const b = { nextWindowAt: same, channel: 3 };

    const sorted = [a, b].sort(compareByUrgency);
    expect(sorted.map((s) => s.channel)).toEqual([3, 12]);
  });
});
