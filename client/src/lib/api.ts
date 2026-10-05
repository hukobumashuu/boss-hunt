import { getToken } from "./auth";
import type {
  ApiErrorBody,
  Boss,
  CoverageEntry,
  DuplicateKillWarning,
  TrackerEntry,
} from "./types";

const BASE_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:4100"
).replace(/\/$/, "");

export class ApiError<T = undefined> extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: T,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  const responseText = await res.text();
  let body: { success: true; message: string; data: T } | ApiErrorBody<unknown>;

  try {
    body = JSON.parse(responseText) as
      { success: true; message: string; data: T } | ApiErrorBody<unknown>;
  } catch {
    throw new ApiError(
      res.status,
      res.ok
        ? "The server returned an invalid response."
        : `Request failed (${res.status}).`,
    );
  }

  if (!res.ok || !body.success) {
    throw new ApiError(res.status, body.message, body.data);
  }
  return body.data;
}

export function fetchTracker(): Promise<TrackerEntry[]> {
  return request<TrackerEntry[]>("/api/tracker");
}

export function fetchBosses(): Promise<Boss[]> {
  return request<Boss[]>("/api/bosses");
}

export function logKill(input: {
  bossId: number;
  channel: number;
  force?: boolean;
}) {
  return request<{ id: number; loggedByName: string }>("/api/kills", {
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
