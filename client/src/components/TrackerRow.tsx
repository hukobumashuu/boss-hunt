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

  const killedAtLabel = `Killed ${formatTimeOfDay(entry.lastKilledAt)}`;
  // "Didn't respawn Nx" - windowsElapsed is already computed server-side
  // from elapsed time alone, no separate "log a miss" action exists or
  // is needed; this is just putting it in words a hunter would say,
  // instead of the more technical "N windows passed".
  const statusDetail =
    entry.status === "open"
      ? entry.windowsElapsed > 0
        ? `Didn't respawn ${entry.windowsElapsed}x`
        : "May be up"
      : `Opens in ${formatCountdown(entry.nextWindowAt, now)}`;

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
      <div className="row__status-dot" aria-hidden="true" />
      <div className="row__main">
        <div className="row__title">
          <span className="row__boss">{entry.bossName}</span>
          <span className="row__channel">Ch {entry.channel}</span>
        </div>
        <div className="row__detail">
          <span>{killedAtLabel}</span>
          <span aria-hidden="true"> · </span>
          <span className="row__status-label">
            {STATUS_LABEL[entry.status]}
          </span>
          <span aria-hidden="true"> · </span>
          <span>{statusDetail}</span>
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
