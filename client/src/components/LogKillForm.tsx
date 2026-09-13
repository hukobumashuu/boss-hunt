import { useState } from "react";
import type { Boss } from "../lib/types";
import { ApiError } from "../lib/api";
import { useLogKill } from "../lib/queries";
import { getBossLetter } from "../lib/bossShorthand";

interface PendingDuplicate {
  channel: number;
  lastLoggedBy: string;
  lastKilledAt: string;
}

const CHANNELS = Array.from({ length: 30 }, (_, i) => i + 1);

export function LogKillForm({ bosses }: { bosses: Boss[] }) {
  const [selectedBoss, setSelectedBoss] = useState<Boss | null>(null);
  const [duplicate, setDuplicate] = useState<PendingDuplicate | null>(null);
  const [lastLoggedChannel, setLastLoggedChannel] = useState<number | null>(
    null,
  );
  const logKill = useLogKill();

  function handleChannelTap(channel: number, force: boolean) {
    if (!selectedBoss) return;
    logKill.mutate(
      { bossId: selectedBoss.id, channel, force },
      {
        onSuccess: () => {
          setDuplicate(null);
          setLastLoggedChannel(channel);
          // Stay on the same boss - the next kill you log is often the
          // same boss on a different channel, not a different boss.
          window.setTimeout(() => setLastLoggedChannel(null), 2000);
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
