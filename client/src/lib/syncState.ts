import { MAX_KILL_AGE_MS } from "./killIntent";
import { MAX_QUERY_RETRIES } from "./retry";
import { formatAge, formatTimeOfDay } from "./time";

const NOTICEABLY_OLD_MS = 45_000;

export type SyncTone = "muted" | "warn" | "error";

export interface SyncState {
  tone: SyncTone;
  message: string;
  showRetry: boolean;
}

export interface SyncInput {
  isOnline: boolean;
  hasData: boolean;
  isFetching: boolean;
  isError: boolean;
  failureCount: number;
  dataUpdatedAt: number;
  nowMs: number;
}

export function describeSyncState(input: SyncInput): SyncState {
  const { isOnline, hasData, isFetching, isError, failureCount, dataUpdatedAt } =
    input;
  const attempts = MAX_QUERY_RETRIES + 1;
  const ageMs = dataUpdatedAt > 0 ? input.nowMs - dataUpdatedAt : 0;
  const syncedTime =
    dataUpdatedAt > 0
      ? formatTimeOfDay(new Date(dataUpdatedAt).toISOString())
      : "";
  const shown = `Showing data from ${syncedTime} (${formatAge(ageMs)}).`;

  if (!isOnline) {
    return {
      tone: "warn",
      showRetry: false,
      message: hasData
        ? `You're offline. ${shown} Kills you log will send when you're back online.`
        : "You're offline. The tracker will load when you're back online.",
    };
  }

  if (!hasData && !isError) {
    return {
      tone: "warn",
      showRetry: false,
      message:
        failureCount > 0
          ? `The server is waking up. Still trying (attempt ${failureCount + 1} of ${attempts})...`
          : "Loading tracker...",
    };
  }

  if (isError) {
    return {
      tone: "error",
      showRetry: true,
      message: hasData
        ? `Can't reach the server. ${shown}`
        : "Couldn't reach the server.",
    };
  }

  if (failureCount > 0 && isFetching) {
    return {
      tone: "warn",
      showRetry: false,
      message: `The server is slow to respond. Retrying (attempt ${failureCount + 1} of ${attempts})... ${shown}`,
    };
  }

  if (isFetching && ageMs > NOTICEABLY_OLD_MS) {
    return {
      tone: "warn",
      showRetry: false,
      message: `Updating... ${shown}`,
    };
  }

  return { tone: "muted", showRetry: false, message: `Synced ${syncedTime}` };
}

export interface KillProgressInput {
  isPending: boolean;
  isPaused: boolean;
  failureCount: number;
}

export interface KillProgress {
  buttonLabel: string;
  note: string | null;
  waiting: boolean;
}

export function describeKillProgress(input: KillProgressInput): KillProgress {
  if (!input.isPending) {
    return { buttonLabel: "Log kill", note: null, waiting: false };
  }
  if (input.isPaused) {
    const minutes = Math.round(MAX_KILL_AGE_MS / 60_000);
    return {
      buttonLabel: "Waiting…",
      note: `Waiting for connection. It will send when you're back online and keep the time you tapped, up to ${minutes} minutes ago.`,
      waiting: true,
    };
  }
  if (input.failureCount > 0) {
    return {
      buttonLabel: "Retrying…",
      note: "The server is slow to respond. Retrying...",
      waiting: false,
    };
  }
  return { buttonLabel: "Logging…", note: "Logging...", waiting: false };
}
