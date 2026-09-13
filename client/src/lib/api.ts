import { getToken } from './auth';
import type {
  ApiErrorBody,
  Boss,
  DuplicateKillWarning,
  TrackerEntry,
} from './types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4100';

/**
 * Carries the HTTP status so callers can tell "not authenticated" (401),
 * "someone else just logged this" (409, with lastLoggedBy/lastKilledAt in
 * `data`), and "too many requests" (429) apart - each needs different UI,
 * not just a generic error message.
 */
export class ApiError<T = undefined> extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: T,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  const body = (await res.json()) as
    | { success: true; message: string; data: T }
    | ApiErrorBody<unknown>;

  if (!body.success) {
    throw new ApiError(res.status, body.message, body.data);
  }
  return body.data;
}

export function fetchTracker(): Promise<TrackerEntry[]> {
  return request<TrackerEntry[]>('/api/tracker');
}

export function fetchBosses(): Promise<Boss[]> {
  return request<Boss[]>('/api/bosses');
}

export function logKill(input: {
  bossId: number;
  channel: number;
  force?: boolean;
}) {
  return request<{ id: number; loggedByName: string }>('/api/kills', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type { DuplicateKillWarning };
