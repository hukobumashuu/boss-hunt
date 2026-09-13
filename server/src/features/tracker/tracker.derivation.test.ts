import { describe, it, expect } from 'bun:test';
import { computeWindowState, compareByUrgency } from './tracker.derivation';

const HOUR = 60 * 60 * 1000;

describe('computeWindowState', () => {
  it('is locked before the first window', () => {
    const killedAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-01T02:00:00Z'); // 2h in, interval is 4h
    const state = computeWindowState(killedAt, 4, now);

    expect(state.status).toBe('locked');
    expect(state.windowsElapsed).toBe(0);
    expect(state.nextWindowAt).toEqual(new Date('2026-01-01T04:00:00Z'));
  });

  it('flips to opening_soon inside the threshold before the first window', () => {
    const killedAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-01T03:45:00Z'); // 15 min before 4h mark
    const state = computeWindowState(killedAt, 4, now);

    expect(state.status).toBe('opening_soon');
    expect(state.windowsElapsed).toBe(0);
  });

  it('flips to open the instant the first window boundary passes', () => {
    const killedAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date(killedAt.getTime() + 4 * HOUR + 1); // 1ms past
    const state = computeWindowState(killedAt, 4, now);

    expect(state.status).toBe('open');
    expect(state.windowsElapsed).toBe(1);
  });

  it('stays open and keeps counting elapsed windows indefinitely', () => {
    const killedAt = new Date('2026-01-01T00:00:00Z');
    const now = new Date(killedAt.getTime() + 13 * HOUR); // 3 full windows + partial 4th
    const state = computeWindowState(killedAt, 4, now);

    expect(state.status).toBe('open');
    expect(state.windowsElapsed).toBe(3);
    expect(state.nextWindowAt).toEqual(
      new Date(killedAt.getTime() + 16 * HOUR),
    );
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
  const open3 = {
    windowsElapsed: 3,
    nextWindowAt: new Date(3000),
    status: 'open' as const,
  };
  const open1 = {
    windowsElapsed: 1,
    nextWindowAt: new Date(1000),
    status: 'open' as const,
  };
  const soonAt2000 = {
    windowsElapsed: 0,
    nextWindowAt: new Date(2000),
    status: 'opening_soon' as const,
  };
  const lockedAt5000 = {
    windowsElapsed: 0,
    nextWindowAt: new Date(5000),
    status: 'locked' as const,
  };

  it('ranks open above opening_soon above locked regardless of timestamps', () => {
    const sorted = [lockedAt5000, soonAt2000, open1].sort(compareByUrgency);
    expect(sorted.map((s) => s.status)).toEqual([
      'open',
      'opening_soon',
      'locked',
    ]);
  });

  it('within open, ranks the most-overdue (highest windowsElapsed) first', () => {
    const sorted = [open1, open3].sort(compareByUrgency);
    expect(sorted[0]).toBe(open3);
  });

  it('within locked/opening_soon, ranks soonest nextWindowAt first', () => {
    const sorted = [lockedAt5000, soonAt2000].sort(compareByUrgency);
    expect(sorted[0]).toBe(soonAt2000);
  });
});
