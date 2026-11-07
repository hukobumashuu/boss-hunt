import { describe, expect, it } from 'bun:test';
import { computeWindowState } from './tracker.derivation';
import type { WindowStatus } from './tracker.derivation';

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
  {
    label: 'exactly at the kill',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 4,
    now: '2026-01-01T00:00:00.000Z',
    status: 'locked',
    windowsElapsed: 0,
    nextWindowAt: '2026-01-01T04:00:00.000Z',
  },
  {
    label: 'far before the first window',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 4,
    now: '2026-01-01T01:00:00.000Z',
    status: 'locked',
    windowsElapsed: 0,
    nextWindowAt: '2026-01-01T04:00:00.000Z',
  },
  {
    label: '31 minutes before the first window',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 4,
    now: '2026-01-01T03:29:00.000Z',
    status: 'locked',
    windowsElapsed: 0,
    nextWindowAt: '2026-01-01T04:00:00.000Z',
  },
  {
    label: 'exactly 30 minutes before the first window',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 4,
    now: '2026-01-01T03:30:00.000Z',
    status: 'opening_soon',
    windowsElapsed: 0,
    nextWindowAt: '2026-01-01T04:00:00.000Z',
  },
  {
    label: '1 ms before the first window',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 4,
    now: '2026-01-01T03:59:59.999Z',
    status: 'opening_soon',
    windowsElapsed: 0,
    nextWindowAt: '2026-01-01T04:00:00.000Z',
  },
  {
    label: 'exactly at the first window',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 4,
    now: '2026-01-01T04:00:00.000Z',
    status: 'open',
    windowsElapsed: 0,
    nextWindowAt: '2026-01-01T04:00:00.000Z',
  },
  {
    label: '1 ms after the first window',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 4,
    now: '2026-01-01T04:00:00.001Z',
    status: 'open',
    windowsElapsed: 0,
    nextWindowAt: '2026-01-01T04:00:00.000Z',
  },
  {
    label: 'exactly at the end of the grace period',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 4,
    now: '2026-01-01T04:10:00.000Z',
    status: 'open',
    windowsElapsed: 0,
    nextWindowAt: '2026-01-01T04:00:00.000Z',
  },
  {
    label: '1 ms after the grace period ends',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 4,
    now: '2026-01-01T04:10:00.001Z',
    status: 'locked',
    windowsElapsed: 1,
    nextWindowAt: '2026-01-01T08:00:00.000Z',
  },
  {
    label: 'rolled forward, far from the next window',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 4,
    now: '2026-01-01T04:11:00.000Z',
    status: 'locked',
    windowsElapsed: 1,
    nextWindowAt: '2026-01-01T08:00:00.000Z',
  },
  {
    label: 'rolled forward, 30 minutes before the next window',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 4,
    now: '2026-01-01T07:30:00.000Z',
    status: 'opening_soon',
    windowsElapsed: 1,
    nextWindowAt: '2026-01-01T08:00:00.000Z',
  },
  {
    label: 'rolled forward, 31 minutes before the next window',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 4,
    now: '2026-01-01T07:29:00.000Z',
    status: 'locked',
    windowsElapsed: 1,
    nextWindowAt: '2026-01-01T08:00:00.000Z',
  },
  {
    label: 'exactly at the second window',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 4,
    now: '2026-01-01T08:00:00.000Z',
    status: 'open',
    windowsElapsed: 1,
    nextWindowAt: '2026-01-01T08:00:00.000Z',
  },
  {
    label: '4 windows missed',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 4,
    now: '2026-01-01T16:11:00.000Z',
    status: 'locked',
    windowsElapsed: 4,
    nextWindowAt: '2026-01-01T20:00:00.000Z',
  },
  {
    label: 'exactly 5 windows missed (stale)',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 4,
    now: '2026-01-01T20:11:00.000Z',
    status: 'locked',
    windowsElapsed: 5,
    nextWindowAt: '2026-01-02T00:00:00.000Z',
  },
  {
    label: 'open on the 10th window',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 4,
    now: '2026-01-02T16:05:00.000Z',
    status: 'open',
    windowsElapsed: 9,
    nextWindowAt: '2026-01-02T16:00:00.000Z',
  },
  {
    label: '107 windows missed',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 4,
    now: '2026-01-18T20:30:00.000Z',
    status: 'locked',
    windowsElapsed: 107,
    nextWindowAt: '2026-01-19T00:00:00.000Z',
  },
  {
    label: 'now before the kill (clock skew)',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 4,
    now: '2025-12-31T23:00:00.000Z',
    status: 'locked',
    windowsElapsed: 0,
    nextWindowAt: '2026-01-01T04:00:00.000Z',
  },
  {
    label: 'now 1 ms before the kill',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 4,
    now: '2025-12-31T23:59:59.999Z',
    status: 'locked',
    windowsElapsed: 0,
    nextWindowAt: '2026-01-01T04:00:00.000Z',
  },
  {
    label: '2.5 hour interval, at the window',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 2.5,
    now: '2026-01-01T02:30:00.000Z',
    status: 'open',
    windowsElapsed: 0,
    nextWindowAt: '2026-01-01T02:30:00.000Z',
  },
  {
    label: '2.5 hour interval, in grace',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 2.5,
    now: '2026-01-01T02:33:00.000Z',
    status: 'open',
    windowsElapsed: 0,
    nextWindowAt: '2026-01-01T02:30:00.000Z',
  },
  {
    label: '6 hour interval, opening soon after one miss',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 6,
    now: '2026-01-01T11:40:00.000Z',
    status: 'opening_soon',
    windowsElapsed: 1,
    nextWindowAt: '2026-01-01T12:00:00.000Z',
  },
  {
    label: '24 hour interval, locked',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 24,
    now: '2026-01-01T05:00:00.000Z',
    status: 'locked',
    windowsElapsed: 0,
    nextWindowAt: '2026-01-02T00:00:00.000Z',
  },
  {
    label: '1 hour interval, many windows',
    baseline: '2026-01-01T00:00:00.000Z',
    hours: 1,
    now: '2026-01-02T13:12:00.000Z',
    status: 'locked',
    windowsElapsed: 37,
    nextWindowAt: '2026-01-02T14:00:00.000Z',
  },
  {
    label: 'baseline with milliseconds, at the window',
    baseline: '2026-01-01T00:00:00.123Z',
    hours: 4,
    now: '2026-01-01T04:00:00.123Z',
    status: 'open',
    windowsElapsed: 0,
    nextWindowAt: '2026-01-01T04:00:00.123Z',
  },
  {
    label: 'baseline with milliseconds, 1 ms before the window',
    baseline: '2026-01-01T00:00:00.123Z',
    hours: 4,
    now: '2026-01-01T04:00:00.122Z',
    status: 'opening_soon',
    windowsElapsed: 0,
    nextWindowAt: '2026-01-01T04:00:00.123Z',
  },
  {
    label: 'baseline with milliseconds, after grace',
    baseline: '2026-01-01T00:00:00.123Z',
    hours: 4,
    now: '2026-01-01T04:10:00.124Z',
    status: 'locked',
    windowsElapsed: 1,
    nextWindowAt: '2026-01-01T08:00:00.123Z',
  },
];

describe('status rules contract', () => {
  for (const c of CONTRACT) {
    it(c.label, () => {
      const state = computeWindowState(
        new Date(c.baseline),
        c.hours,
        new Date(c.now),
      );

      expect(state.status).toBe(c.status);
      expect(state.windowsElapsed).toBe(c.windowsElapsed);
      expect(state.nextWindowAt.toISOString()).toBe(c.nextWindowAt);
    });
  }
});
