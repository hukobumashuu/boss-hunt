import { useEffect, useMemo, useState } from "react";
import { Clock } from "./Clock";
import { ConfirmDialog } from "./ConfirmDialog";
import { FilterChips } from "./FilterChips";
import { LogKillForm } from "./LogKillForm";
import { TrackerRow } from "./TrackerRow";
import { NoAccess } from "./NoAccess";
import { useBosses, useLogMaintenanceReset, useTracker } from "../lib/queries";
import { ApiError, fetchCoverage } from "../lib/api";
import { clearToken } from "../lib/auth";
import { formatCopyText } from "../lib/copyFormat";
import type { CoverageEntry } from "../lib/types";

const TICK_MS = 30_000;
const COPIED_MESSAGE_MS = 2000;
// Keep in sync with server's STALE_MISSED_THRESHOLD (see copyFormat.ts's
// own copy of this note).
const STALE_MISSED_THRESHOLD = 5;

export function Dashboard() {
  const { data, error, isLoading } = useTracker();
  const { data: bosses } = useBosses();
  const [selectedBossIds, setSelectedBossIds] = useState<Set<number>>(
    new Set(),
  );
  const [now, setNow] = useState(() => new Date());
  const [copied, setCopied] = useState(false);
  const [justReset, setJustReset] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const logReset = useLogMaintenanceReset();
  const [coverage, setCoverage] = useState<CoverageEntry[] | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Empty selection means "no filter" - show everything. Toggling any
  // boss narrows the list to just what's selected; any combination is
  // valid, including all five landing back on "everything".
  const visible = useMemo(() => {
    const all = data ?? [];
    if (selectedBossIds.size === 0) return all;
    return all.filter((entry) => selectedBossIds.has(entry.bossId));
  }, [data, selectedBossIds]);

  // Grace period is already baked into windowsElapsed itself now (see
  // tracker.derivation.ts) - it doesn't count a cycle as missed until
  // that cycle's own grace period has actually run out. So the plain
  // threshold check is correct here; no separate status carve-out
  // needed.
  const isStale = (e: (typeof visible)[number]) =>
    e.windowsElapsed >= STALE_MISSED_THRESHOLD;
  const active = useMemo(() => visible.filter((e) => !isStale(e)), [visible]);
  const stale = useMemo(() => visible.filter(isStale), [visible]);

  function toggleBoss(bossId: number) {
    setSelectedBossIds((prev) => {
      const next = new Set(prev);
      if (next.has(bossId)) next.delete(bossId);
      else next.add(bossId);
      return next;
    });
  }

  async function handleCopy() {
    const text = formatCopyText(active, now);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), COPIED_MESSAGE_MS);
  }

  function handleMaintenanceReset() {
    setConfirmingReset(true);
  }

  function confirmMaintenanceReset() {
    setConfirmingReset(false);
    logReset.mutate(undefined, {
      onSuccess: () => {
        setJustReset(true);
        window.setTimeout(() => setJustReset(false), COPIED_MESSAGE_MS);
      },
    });
  }

  async function handleShowCoverage() {
    if (coverage) {
      setCoverage(null); // toggle off if already showing
      return;
    }
    setCoverageLoading(true);
    try {
      setCoverage(await fetchCoverage());
    } finally {
      setCoverageLoading(false);
    }
  }

  if (error instanceof ApiError && error.status === 401) {
    clearToken();
    return <NoAccess />;
  }

  return (
    <div className="dashboard">
      <Clock />

      <button
        type="button"
        className="button button--ghost maintenance-reset-button"
        onClick={handleMaintenanceReset}
        disabled={logReset.isPending}
      >
        {logReset.isPending
          ? "Logging restart..."
          : justReset
            ? "Restart logged"
            : "Maintenance just happened"}
      </button>
      {logReset.isError && (
        <p className="status-text status-text--error">
          Couldn't log the restart - try again in a moment.
        </p>
      )}

      <ConfirmDialog
        open={confirmingReset}
        message={
          "Log a maintenance restart? This tells the tracker every boss " +
          "just came back up, for every channel - it doesn't delete or " +
          'edit any past kills, it just changes what counts as "due" ' +
          "going forward."
        }
        confirmLabel="Log restart"
        onConfirm={confirmMaintenanceReset}
        onCancel={() => setConfirmingReset(false)}
      />

      {bosses && bosses.length > 0 && <LogKillForm bosses={bosses} />}

      <button
        type="button"
        className="button button--ghost"
        onClick={() => void handleShowCoverage()}
      >
        {coverageLoading
          ? "Loading..."
          : coverage
            ? "Hide missing channels"
            : "Show missing channels"}
      </button>

      {coverage && (
        <ul className="coverage-list">
          {coverage.map((c) => (
            <li key={c.bossId}>
              <strong>{c.bossName}</strong>
              {c.missing.length === 0 ? (
                <span> - no missing channels</span>
              ) : (
                <span> - missing: {c.missing.join(", ")}</span>
              )}
              {c.stale.length > 0 && (
                <div>
                  Unconfirmed:{" "}
                  {c.stale
                    .map((s) => `Ch ${s.channel} (${s.missed}x)`)
                    .join(", ")}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {isLoading && <p className="status-text">Loading tracker...</p>}

      {!isLoading && data && data.length === 0 && (
        <p className="status-text">
          No kills logged yet. Log the first one above to start tracking.
        </p>
      )}

      {!isLoading && data && data.length > 0 && bosses && (
        <>
          <FilterChips
            bosses={bosses}
            selected={selectedBossIds}
            onToggle={toggleBoss}
          />
          <ul className="tracker-list">
            {active.map((entry) => (
              <TrackerRow
                key={`${entry.bossId}-${entry.channel}`}
                entry={entry}
                now={now}
              />
            ))}
          </ul>
          <button
            type="button"
            className="button button--ghost copy-button"
            onClick={() => void handleCopy()}
          >
            {copied ? "Copied!" : "Copy as text"}
          </button>
          {stale.length > 0 && (
            <>
              <p className="status-text">
                Possibly not ours anymore ({stale.length})
              </p>
              <ul className="tracker-list">
                {stale.map((entry) => (
                  <TrackerRow
                    key={`${entry.bossId}-${entry.channel}`}
                    entry={entry}
                    now={now}
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {error && !(error instanceof ApiError && error.status === 401) && (
        <p className="status-text status-text--error">
          Couldn't reach the server. Check your connection and try again.
        </p>
      )}
    </div>
  );
}
