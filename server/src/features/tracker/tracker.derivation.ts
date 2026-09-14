/**
 * Core respawn-window math, isolated from Express/Drizzle so it can be
 * unit tested with plain inputs and no database.
 *
 * DESIGN v2 (replaces the old "Open pinned above everything, forever"
 * model): every channel is ranked purely by its own `nextWindowAt` -
 * there is no status tier that jumps a channel to the top just because
 * it's overdue. `status` is now only paint (a color/label on the row),
 * never a sort key.
 *
 * To make that clock comparable across channels, a channel that misses
 * its window doesn't just sit there labeled "open" indefinitely - after
 * a short GRACE_PERIOD_MS (time to actually fight and tap "log kill"),
 * it auto-advances to the *next* tick boundary, exactly as if a new
 * "expected respawn" had been set. That's what makes a channel that
 * missed at 6:27 PM and a channel freshly killed at 6:27 PM both land on
 * "next check ~10:27 PM" and sit next to each other on the wheel,
 * instead of one being stuck at the top forever.
 */

export type WindowStatus = 'locked' | 'opening_soon' | 'open';

export interface WindowState {
  /** Total number of tick boundaries that have passed since the last
   * logged kill, INCLUDING ones the grace period already rolled past.
   * This never resets on its own - it only goes to 0 when a new kill is
   * logged. Used only for the secondary "Missed Nx" display; it plays
   * no part in sorting. */
  windowsElapsed: number;
  /** The tick boundary this channel is currently "aimed at" - either
   * the boundary it just passed (while still inside the grace period)
   * or the next upcoming one (once the grace period has expired). This
   * is the ONLY value channels are sorted by. */
  nextWindowAt: Date;
  /** Visual-only. Never used for sorting or grouping. */
  status: WindowStatus;
}

/** How close to a boundary (before OR after it passes) a row shows as
 * amber/red instead of plain "locked". */
const OPENING_SOON_THRESHOLD_MINUTES = 30;

/** How long a channel is allowed to sit "open" (red, fight-in-progress)
 * after its window opens before the system assumes it was a genuine
 * miss and rolls forward to the next cycle. Chosen to comfortably cover
 * a ~30s-3min fight plus a few seconds to tap "log kill" - see the
 * conversation this was tuned from for the reasoning. */
const GRACE_PERIOD_MINUTES = 10;
const GRACE_PERIOD_MS = GRACE_PERIOD_MINUTES * 60 * 1000;

export function computeWindowState(
  lastKilledAt: Date,
  respawnIntervalHours: number,
  now: Date = new Date(),
): WindowState {
  if (respawnIntervalHours <= 0) {
    throw new Error('respawnIntervalHours must be positive');
  }

  const intervalMs = respawnIntervalHours * 60 * 60 * 1000;

  // Guard against clock skew / bad data the same way the old version
  // did: never let "elapsed" go negative.
  const elapsedMs = Math.max(0, now.getTime() - lastKilledAt.getTime());

  // How many full tick boundaries have already been passed, and how far
  // into the *current* one we are. E.g. if 9h10m have passed on a 4h
  // timer: ticksPassed = 2 (the 4h and 8h marks), msIntoCurrentTick =
  // 1h10m past the 8h mark.
  const ticksPassed = Math.floor(elapsedMs / intervalMs);
  const msIntoCurrentTick = elapsedMs - ticksPassed * intervalMs;

  if (ticksPassed === 0) {
    // Hasn't hit its first boundary yet - nothing to auto-advance.
    const nextWindowAt = new Date(lastKilledAt.getTime() + intervalMs);
    return {
      windowsElapsed: 0,
      nextWindowAt,
      status: deriveApproachStatus(nextWindowAt, now),
    };
  }

  if (msIntoCurrentTick <= GRACE_PERIOD_MS) {
    // At least one boundary has passed, and we're still inside the
    // grace period right after it - treat it as "open" (someone may be
    // mid-fight right now) and anchor nextWindowAt at the boundary that
    // just passed, so it doesn't drift while the fight is happening.
    const nextWindowAt = new Date(
      lastKilledAt.getTime() + ticksPassed * intervalMs,
    );
    return {
      windowsElapsed: ticksPassed,
      nextWindowAt,
      status: 'open',
    };
  }

  // Grace period on the most recent boundary has expired with no kill
  // logged - auto-advance to the next boundary. windowsElapsed keeps
  // counting the true miss count (informational only); nextWindowAt and
  // status both roll forward as if this were a fresh cycle.
  const nextWindowAt = new Date(
    lastKilledAt.getTime() + (ticksPassed + 1) * intervalMs,
  );
  return {
    windowsElapsed: ticksPassed,
    nextWindowAt,
    status: deriveApproachStatus(nextWindowAt, now),
  };
}

/** Shared by both "haven't opened yet" and "rolled forward to the next
 * cycle" cases: locked, unless we're within the amber threshold of the
 * upcoming boundary. */
function deriveApproachStatus(nextWindowAt: Date, now: Date): WindowStatus {
  const minutesUntilNext = (nextWindowAt.getTime() - now.getTime()) / 60_000;
  return minutesUntilNext <= OPENING_SOON_THRESHOLD_MINUTES
    ? 'opening_soon'
    : 'locked';
}

/**
 * Pure time sort - the "wheel". Every channel, regardless of status,
 * is ordered strictly by whose nextWindowAt comes soonest. `status` is
 * intentionally NOT consulted here; a channel showing red does not
 * outrank a channel showing grey just because it's red. Channel number
 * is only a tie-breaker for the rare case two entries land on the exact
 * same millisecond, so the order stays stable instead of flickering.
 */
export function compareByUrgency(
  a: { nextWindowAt: Date; channel: number },
  b: { nextWindowAt: Date; channel: number },
): number {
  const diff = a.nextWindowAt.getTime() - b.nextWindowAt.getTime();
  if (diff !== 0) return diff;
  return a.channel - b.channel;
}
