import { useState } from "react";
import type { TrackerEntry } from "../lib/types";
import { ApiError } from "../lib/api";
import { useLogKill } from "../lib/queries";
import { formatCountdown, formatTimeOfDay } from "../lib/time";

interface DuplicateInfo {
  lastLoggedBy: string;
  lastKilledAt: string;
}

const STATUS_LABEL: Record<TrackerEntry["status"], string> = {
  open: "Open",
  opening_soon: "Opening soon",
  locked: "Locked",
};

export function TrackerRow({ entry, now }: { entry: TrackerEntry; now: Date }) {
  const logKill = useLogKill();
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);

  // Headline flip: the thing you act on is "when do I go back", not
  // "when did it die" - so the countdown/next-check time is now the big
  // text, and the kill time is demoted to a small secondary line.
  const nextCheckLabel =
    entry.status === "open"
      ? "May be up now"
      : `Next check: ${formatCountdown(entry.nextWindowAt, now)}`;
  // Secondary line: the clock time to act on, not the clock time that
  // already happened. This applies even while status is "open" - the
  // window is pinned at the boundary it just crossed (see
  // tracker.derivation.ts), so this line keeps showing that same anchor
  // straight through the grace period and into whatever it advances to
  // next, instead of freezing on when the boss last died.
  const nextCheckTimeLabel = `Check at ${formatTimeOfDay(entry.nextWindowAt)}`;

  // windowsElapsed keeps counting real misses even after the row has
  // rolled forward and gone back to "locked" - it no longer affects
  // sorting or the status color, it's just an honest "this has actually
  // been missed before" note so that information isn't silently lost
  // once the row leaves the top of the list.
  const missedNote =
    entry.windowsElapsed > 0 ? `Missed ${entry.windowsElapsed}x` : null;

  function handleLog(force: boolean) {
    logKill.mutate(
      { bossId: entry.bossId, channel: entry.channel, force },
      {
        onSuccess: () => setDuplicate(null),
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409 && err.data) {
            setDuplicate(err.data as DuplicateInfo);
          }
        },
      },
    );
  }

  return (
    <li className={`row row--${entry.status}`}>
      {/* Status color only - never affects position in the list. */}
      <div className="row__status-dot" aria-hidden="true" />
      <div className="row__main">
        <div className="row__title">
          <span className="row__boss">{entry.bossName}</span>
          <span className="row__channel">Ch {entry.channel}</span>
        </div>
        <div className="row__detail">
          <span className="row__next-check">{nextCheckLabel}</span>
          <span aria-hidden="true"> · </span>
          <span className="row__status-label">
            {STATUS_LABEL[entry.status]}
          </span>
          {missedNote && (
            <>
              <span aria-hidden="true"> · </span>
              <span className="row__missed-note">{missedNote}</span>
            </>
          )}
        </div>
        <div className="row__detail row__detail--secondary">
          <span>{nextCheckTimeLabel}</span>
        </div>
        {duplicate && (
          <div className="row__confirm">
            <span>
              {duplicate.lastLoggedBy} already logged this at{" "}
              {new Date(duplicate.lastKilledAt).toLocaleTimeString("en-PH", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
              . Log anyway?
            </span>
            <div className="row__confirm-actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={() => setDuplicate(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="button button--ghost"
                onClick={() => handleLog(true)}
              >
                Log anyway
              </button>
            </div>
          </div>
        )}
      </div>
      <button
        type="button"
        className="button button--primary"
        onClick={() => handleLog(false)}
        disabled={logKill.isPending}
      >
        {logKill.isPending ? "Logging…" : "Log kill"}
      </button>
    </li>
  );
}
