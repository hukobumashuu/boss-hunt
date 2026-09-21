import { useState } from "react";
import type { Boss } from "../lib/types";
import { ApiError } from "../lib/api";
import { useLogKill, useVoidKill } from "../lib/queries";
import { getBossLetter } from "../lib/bossShorthand";

interface PendingDuplicate {
  channel: number;
  lastLoggedBy: string;
  lastKilledAt: string;
}

// How long the "Undo" affordance stays visible after a successful log.
// Well under the server's own VOID_WINDOW_MINUTES (5) - this is for
// catching a fat-fingered boss/channel in the same breath, not for
// browsing back through history. If it's been longer than this, voiding
// from the tracker row's own confirm-free path isn't offered at all;
// treat it as done and log a correction the normal way instead.
const UNDO_VISIBLE_MS = 8_000;

const CHANNELS = Array.from({ length: 30 }, (_, i) => i + 1);

export function LogKillForm({ bosses }: { bosses: Boss[] }) {
  const [selectedBoss, setSelectedBoss] = useState<Boss | null>(null);
  const [duplicate, setDuplicate] = useState<PendingDuplicate | null>(null);
  const [lastLoggedChannel, setLastLoggedChannel] = useState<number | null>(
    null,
  );
  const [undoable, setUndoable] = useState<{
    id: number;
    channel: number;
  } | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  const logKill = useLogKill();
  const voidKill = useVoidKill();

  function handleChannelTap(channel: number, force: boolean) {
    if (!selectedBoss) return;
    logKill.mutate(
      { bossId: selectedBoss.id, channel, force },
      {
        onSuccess: (result) => {
          setDuplicate(null);
          setUndoError(null);
          setLastLoggedChannel(channel);
          // Stay on the same boss - the next kill you log is often the
          // same boss on a different channel, not a different boss.
          window.setTimeout(() => setLastLoggedChannel(null), 2000);

          setUndoable({ id: result.id, channel });
          window.setTimeout(() => {
            setUndoable((current) =>
              current?.id === result.id ? null : current,
            );
          }, UNDO_VISIBLE_MS);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409 && err.data) {
            const data = err.data as {
              lastLoggedBy: string;
              lastKilledAt: string;
            };
            setDuplicate({ channel, ...data });
          }
        },
      },
    );
  }

  function handleUndo() {
    if (!undoable) return;
    const { id } = undoable;
    voidKill.mutate(id, {
      onSuccess: () => {
        setUndoable((current) => (current?.id === id ? null : current));
      },
      onError: () => {
        // Most likely: the window already lapsed server-side, or a
        // newer kill landed for this channel in the meantime - either
        // way there's nothing left to undo, so drop the affordance
        // rather than let someone retry into the same rejection.
        setUndoable((current) => (current?.id === id ? null : current));
        setUndoError(
          "Couldn't undo that - it may be too late, or someone already logged a newer kill for this channel.",
        );
      },
    });
  }

  if (!selectedBoss) {
    return (
      <div className="log-form">
        <p className="log-form__label">Log a kill</p>
        <div className="log-form__boss-grid">
          {bosses.map((boss) => (
            <button
              key={boss.id}
              type="button"
              className="log-form__boss-button"
              onClick={() => setSelectedBoss(boss)}
            >
              <span className="log-form__boss-letter">
                {getBossLetter(boss.name)}
              </span>
              <span className="log-form__boss-name">{boss.name}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="log-form">
      <div className="log-form__header">
        <button
          type="button"
          className="button button--ghost"
          onClick={() => {
            setSelectedBoss(null);
            setDuplicate(null);
          }}
        >
          ← {selectedBoss.name}
        </button>
        <span className="log-form__hint">Tap the channel</span>
      </div>

      <div className="log-form__channel-grid">
        {CHANNELS.map((channel) => (
          <button
            key={channel}
            type="button"
            className={`log-form__channel-button ${
              lastLoggedChannel === channel
                ? "log-form__channel-button--just-logged"
                : ""
            }`}
            onClick={() => handleChannelTap(channel, false)}
            disabled={logKill.isPending}
          >
            {channel}
          </button>
        ))}
      </div>

      {undoable && (
        <div className="row__confirm">
          <span>Logged Ch {undoable.channel}.</span>
          <div className="row__confirm-actions">
            <button
              type="button"
              className="button button--ghost"
              onClick={handleUndo}
              disabled={voidKill.isPending}
            >
              {voidKill.isPending ? "Undoing…" : "Undo"}
            </button>
          </div>
        </div>
      )}

      {undoError && (
        <p className="status-text status-text--error">{undoError}</p>
      )}

      {duplicate && (
        <div className="row__confirm">
          <span>
            {duplicate.lastLoggedBy} already logged Ch {duplicate.channel} at{" "}
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
              onClick={() => handleChannelTap(duplicate.channel, true)}
            >
              Log anyway
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
