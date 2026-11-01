import { useRef, useState } from "react";
import type { TrackerEntry } from "../lib/types";
import { ApiError } from "../lib/api";
import { getErrorMessage } from "../lib/errors";
import { reuseOrCreateKillIntent } from "../lib/killIntent";
import type { KillIntent } from "../lib/killIntent";
import { useLogKill } from "../lib/queries";
import { formatCountdown, formatTimeOfDay } from "../lib/time";

interface DuplicateInfo {
  message: string;
  /** When the user first tapped; this is the time the kill will be logged at. */
  tappedAt: number;
}

const STATUS_LABEL: Record<TrackerEntry["status"], string> = {
  open: "Open",
  opening_soon: "Opening soon",
  locked: "Locked",
};

export function TrackerRow({ entry, now }: { entry: TrackerEntry; now: Date }) {
  const logKill = useLogKill();
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  // The current tap, kept until it succeeds or is cancelled, so confirming a
  // warning or retrying a failure still logs the time of the original tap.
  const intentRef = useRef<KillIntent | null>(null);

  const nextCheckLabel =
    entry.status === "open"
      ? "May be up now"
      : `Next check: ${formatCountdown(entry.nextWindowAt, now)}`;
  const nextCheckTimeLabel = `Check at ${formatTimeOfDay(entry.nextWindowAt)}`;

  const missedNote =
    entry.windowsElapsed > 0 ? `Missed ${entry.windowsElapsed}x` : null;

  function handleLog(force: boolean) {
    const intent = reuseOrCreateKillIntent(
      intentRef.current,
      entry.bossId,
      entry.channel,
    );
    intentRef.current = intent;
    setLogError(null);

    logKill.mutate(
      { intent, force },
      {
        onSuccess: () => {
          intentRef.current = null;
          setDuplicate(null);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) {
            setDuplicate({ message: err.message, tappedAt: intent.tappedAt });
            return;
          }
          setDuplicate(null);
          setLogError(getErrorMessage(err, "Couldn't log that kill."));
        },
      },
    );
  }

  function handleCancel() {
    intentRef.current = null;
    setDuplicate(null);
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
            <span className="row__confirm-note">
              {`It will be logged as killed at ${formatTimeOfDay(new Date(duplicate.tappedAt).toISOString())}.`}
            </span>
            <div className="row__confirm-actions">
              <button
                type="button"
                className="button button--ghost"
                onClick={handleCancel}
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
        {logError && (
          <div className="row__error" role="alert">
            <span>{logError}</span>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => handleLog(false)}
              disabled={logKill.isPending}
            >
              Retry
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        className="button button--primary"
        onClick={() => handleLog(false)}
        disabled={logKill.isPending}
      >
        {logKill.isPending
          ? logKill.failureCount > 0
            ? "Retrying…"
            : "Logging…"
          : "Log kill"}
      </button>
    </li>
  );
}
