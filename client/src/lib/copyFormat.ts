import type { TrackerEntry } from "./types";
import { getBossLetter } from "./bossShorthand";
import { formatTimeOfDay } from "./time";

/**
 * Started as a mirror of the guild's own manual format (e.g. "S13
 * 10:11:52"), which recorded when a boss was killed - the only thing
 * manual chat logging could track. That stopped making sense once the
 * app started doing the respawn math: the number people actually act on
 * is "when do I go back" (nextWindowAt), not "when did it die"
 * (lastKilledAt), and pasting the latter into chat re-introduced the
 * exact confusion this project was built to remove. Open entries show
 * "NOW" instead of a clock time, since nextWindowAt for an open entry is
 * pinned to the boundary that already passed (see
 * tracker.derivation.ts) - printing that as a time would read as a
 * future check that's actually already due.
 *
 * The "xN" miss suffix is keyed off `windowsElapsed > 0` alone, not
 * status - a channel that missed a window and already auto-advanced
 * back to locked/opening_soon still gets the suffix. Dropping it the
 * moment status left `open` was the bug: the one channel that most
 * needs the group's attention (it already got missed once) looked
 * identical to one that's never been touched, the next time this text
 * got pasted into chat.
 */
export function formatCopyText(entries: TrackerEntry[], now: Date): string {
  const lines = entries.map((entry) => {
    const letter = getBossLetter(entry.bossName);
    const time =
      entry.status === "open" ? "NOW" : formatTimeOfDay(entry.nextWindowAt);
    const suffix = entry.windowsElapsed > 0 ? ` x${entry.windowsElapsed}` : "";
    return `${letter}${entry.channel} ${time}${suffix}`;
  });

  const header = `Boss Tracker - synced ${formatTimeOfDay(now.toISOString())}`;
  return [header, lines.join("  ")].join("\n");
}
