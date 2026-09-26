import type { TrackerEntry } from "./types";
import { getBossLetter } from "./bossShorthand";
import { formatTimeOfDay } from "./time";

export function formatCopyText(entries: TrackerEntry[], now: Date): string {
  const STALE_MISSED_THRESHOLD = 5;

  const lines = entries
    .filter((entry) => entry.windowsElapsed < STALE_MISSED_THRESHOLD)
    .map((entry) => {
      const displayAt =
        entry.status === "open"
          ? new Date(
              new Date(entry.nextWindowAt).getTime() +
                entry.respawnIntervalHours * 60 * 60 * 1000,
            )
          : new Date(entry.nextWindowAt);
      return { entry, displayAt };
    })
    .sort((a, b) => a.displayAt.getTime() - b.displayAt.getTime())
    .map(({ entry, displayAt }) => {
      const letter = getBossLetter(entry.bossName);
      const time = formatTimeOfDay(displayAt.toISOString());
      const suffix =
        entry.windowsElapsed > 0 ? ` x${entry.windowsElapsed}` : "";
      return `${letter} ${entry.channel} ${time}${suffix}`;
    });

  const header = `Boss Tracker - synced ${formatTimeOfDay(now.toISOString())}`;
  return [header, ...lines].join("\n");
}
