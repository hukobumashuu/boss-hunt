import { useState } from "react";
import type { TrackerEntry } from "../lib/types";
import { ApiError } from "../lib/api";
import { useLogKill } from "../lib/queries";
import { formatCountdown, formatTimeOfDay } from "../lib/time";

interface DuplicateInfo {
  message: string;
}

const STATUS_LABEL: Record<TrackerEntry["status"], string> = {
  open: "Open",
  opening_soon: "Opening soon",
  locked: "Locked",
};

export function TrackerRow({ entry, now }: { entry: TrackerEntry; now: Date }) {
  const logKill = useLogKill();
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);

  const nextCheckLabel =
    entry.status === "open"
      ? "May be up now"
      : `Next check: ${formatCountdown(entry.nextWindowAt, now)}`;
  const nextCheckTimeLabel = `Check at ${formatTimeOfDay(entry.nextWindowAt)}`;

  const missedNote =
    entry.windowsElapsed > 0 ? `Missed ${entry.windowsElapsed}x` : null;

  function handleLog(force: boolean) {
    logKill.mutate(
      { bossId: entry.bossId, channel: entry.channel, force },
      {
        onSuccess: () => setDuplicate(null),
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) {
            setDuplicate({ message: err.message });
          }
        },
      },
    );
  }

  return (
    <li className={`row row--${entry.status}`}>
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
            <span>{duplicate.message}</span>
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
