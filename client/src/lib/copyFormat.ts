import type { TrackerEntry } from './types';
import { getBossLetter } from './bossShorthand';
import { formatTimeOfDay } from './time';

/**
 * Mirrors the guild's own manual format (e.g. "S13 10:11:52") exactly for
 * locked/opening_soon entries - that's the same information they always
 * recorded by hand. The "xN" suffix only appears for open entries, since
 * "didn't respawn N times" is the one piece of information manual
 * logging in chat could never produce - it's the actual reason this
 * project exists, so it's the one thing worth adding to an otherwise
 * unchanged format.
 */
export function formatCopyText(entries: TrackerEntry[], now: Date): string {
  const lines = entries.map((entry) => {
    const letter = getBossLetter(entry.bossName);
    const time = formatTimeOfDay(entry.lastKilledAt);
    const suffix =
      entry.status === 'open' && entry.windowsElapsed > 0
        ? ` x${entry.windowsElapsed}`
        : '';
    return `${letter}${entry.channel} ${time}${suffix}`;
  });

  const header = `Boss Tracker - synced ${formatTimeOfDay(now.toISOString())}`;
  return [header, lines.join('  ')].join('\n');
}
