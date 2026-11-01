import { MAX_QUERY_RETRIES } from "../lib/retry";
import { formatAge, formatTimeOfDay } from "../lib/time";

interface SyncStatusProps {
  hasData: boolean;
  isFetching: boolean;
  isError: boolean;
  /** Failed attempts so far in the current retry sequence. */
  failureCount: number;
  /** When the shown data was last fetched (ms since epoch), 0 if never. */
  dataUpdatedAt: number;
  now: Date;
  onRetry: () => void;
}

// Data older than this while a refresh is running is worth calling out.
const NOTICEABLY_OLD_MS = 45_000;

export function SyncStatus({
  hasData,
  isFetching,
  isError,
  failureCount,
  dataUpdatedAt,
  now,
  onRetry,
}: SyncStatusProps) {
  const attempts = MAX_QUERY_RETRIES + 1;
  const ageMs = dataUpdatedAt > 0 ? now.getTime() - dataUpdatedAt : 0;
  const syncedTime =
    dataUpdatedAt > 0
      ? formatTimeOfDay(new Date(dataUpdatedAt).toISOString())
      : "";
  const shown = `Showing data from ${syncedTime} (${formatAge(ageMs)}).`;

  if (!hasData && !isError) {
    return (
      <p className="sync-status sync-status--warn" role="status">
        {failureCount > 0
          ? `The server is waking up. Still trying (attempt ${failureCount + 1} of ${attempts})...`
          : "Loading tracker..."}
      </p>
    );
  }

  if (isError) {
    return (
      <p className="sync-status sync-status--error" role="alert">
        {hasData
          ? `Can't reach the server. ${shown} `
          : "Couldn't reach the server. "}
        <button type="button" className="sync-status__retry" onClick={onRetry}>
          {isFetching ? "Retrying..." : "Retry now"}
        </button>
      </p>
    );
  }

  if (failureCount > 0 && isFetching) {
    return (
      <p className="sync-status sync-status--warn" role="status">
        {`The server is slow to respond. Retrying (attempt ${failureCount + 1} of ${attempts})... ${shown}`}
      </p>
    );
  }

  if (isFetching && ageMs > NOTICEABLY_OLD_MS) {
    return (
      <p className="sync-status sync-status--warn" role="status">
        {`Updating... ${shown}`}
      </p>
    );
  }

  return (
    <p className="sync-status" role="status">
      {`Synced ${syncedTime}`}
    </p>
  );
}
