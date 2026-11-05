import { describeSyncState } from "../lib/syncState";
import { useIsOnline } from "../lib/useIsOnline";

interface SyncStatusProps {
  hasData: boolean;
  isFetching: boolean;
  isError: boolean;
  failureCount: number;
  dataUpdatedAt: number;
  now: Date;
  onRetry: () => void;
}

export function SyncStatus({
  hasData,
  isFetching,
  isError,
  failureCount,
  dataUpdatedAt,
  now,
  onRetry,
}: SyncStatusProps) {
  const isOnline = useIsOnline();
  const state = describeSyncState({
    isOnline,
    hasData,
    isFetching,
    isError,
    failureCount,
    dataUpdatedAt,
    nowMs: now.getTime(),
  });

  return (
    <p
      className={
        state.tone === "muted"
          ? "sync-status"
          : `sync-status sync-status--${state.tone}`
      }
      role={state.tone === "error" ? "alert" : "status"}
    >
      {state.message}
      {state.showRetry && (
        <>
          {" "}
          <button
            type="button"
            className="sync-status__retry"
            onClick={onRetry}
          >
            {isFetching ? "Retrying..." : "Retry now"}
          </button>
        </>
      )}
    </p>
  );
}
