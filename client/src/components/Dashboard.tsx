import { useEffect, useMemo, useState } from 'react';
import { Clock } from './Clock';
import { FilterChips } from './FilterChips';
import { LogKillForm } from './LogKillForm';
import { TrackerRow } from './TrackerRow';
import { NoAccess } from './NoAccess';
import { useBosses, useTracker } from '../lib/queries';
import { ApiError } from '../lib/api';
import { clearToken } from '../lib/auth';
import { formatCopyText } from '../lib/copyFormat';

const TICK_MS = 30_000;
const COPIED_MESSAGE_MS = 2000;

export function Dashboard() {
  const { data, error, isLoading } = useTracker();
  const { data: bosses } = useBosses();
  const [selectedBossIds, setSelectedBossIds] = useState<Set<number>>(
    new Set(),
  );
  const [now, setNow] = useState(() => new Date());
  const [copied, setCopied] = useState(false);

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

  function toggleBoss(bossId: number) {
    setSelectedBossIds((prev) => {
      const next = new Set(prev);
      if (next.has(bossId)) next.delete(bossId);
      else next.add(bossId);
      return next;
    });
  }

  async function handleCopy() {
    const text = formatCopyText(visible, now);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), COPIED_MESSAGE_MS);
  }

  if (error instanceof ApiError && error.status === 401) {
    clearToken();
    return <NoAccess />;
  }

  return (
    <div className="dashboard">
      <Clock />

      {bosses && bosses.length > 0 && <LogKillForm bosses={bosses} />}

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
            {visible.map((entry) => (
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
            {copied ? 'Copied!' : 'Copy as text'}
          </button>
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
