import { getToken } from "./auth";
import { ApiError } from "./errors";
import { withTimeout } from "./withTimeout";
import type {
  ApiErrorBody,
  Boss,
  CoverageEntry,
  DuplicateKillWarning,
  LoggedKill,
  TrackerEntry,
} from "./types";

const BASE_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:4100"
).replace(/\/$/, "");

// Existing components import ApiError from here.
export { ApiError };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();

  // Only network I/O runs under the deadline; parsing happens afterwards.
  const { ok, status, text } = await withTimeout(
    async (signal) => {
      const res = await fetch(`${BASE_URL}${path}`, {
        ...init,
        signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...init?.headers,
        },
      });
      return { ok: res.ok, status: res.status, text: await res.text() };
    },
    { signal: init?.signal ?? undefined },
  );

  let body: { success: true; message: string; data: T } | ApiErrorBody<unknown>;

  try {
    body = JSON.parse(text) as
      { success: true; message: string; data: T } | ApiErrorBody<unknown>;
  } catch {
    throw new ApiError(
      status,
      ok
        ? "The server returned an invalid response."
        : `Request failed (${status}).`,
    );
  }

  if (!ok || !body.success) {
    throw new ApiError(status, body.message, body.data);
  }
  return body.data;
}

export function fetchTracker(): Promise<TrackerEntry[]> {
  return request<TrackerEntry[]>("/api/tracker");
}

export function fetchBosses(): Promise<Boss[]> {
  return request<Boss[]>("/api/bosses");
}

export interface LogKillInput {
  bossId: number;
  channel: number;
  force: boolean;
  /** Idempotency key: the same key never logs two kills. */
  requestId: string;
  /** How long ago the user tapped, so a delayed request keeps the real time. */
  killedAgoMs: number;
}

export function logKill(input: LogKillInput) {
  return request<LoggedKill>("/api/kills", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function voidKill(killId: number) {
  return request<null>(`/api/kills/${killId}/void`, { method: "POST" });
}

export function logMaintenanceReset() {
  return request<{ id: number; resetAt: string }>("/api/resets", {
    method: "POST",
  });
}

export function fetchCoverage() {
  return request<CoverageEntry[]>("/api/coverage");
}

export type { DuplicateKillWarning };
