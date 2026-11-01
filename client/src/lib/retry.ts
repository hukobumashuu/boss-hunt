import { isRetryableError } from "./errors";

// Reads retry a couple of times (a cold server can need ~a minute in total).
// Writes retry once, and only because every write that retries carries an
// idempotency key, so a retry can never log the same kill twice.
export const MAX_QUERY_RETRIES = 2;
export const MAX_WRITE_RETRIES = 1;

export function retryDelayMs(failureCount: number): number {
  return Math.min(1_000 * 2 ** failureCount, 4_000);
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_QUERY_RETRIES && isRetryableError(error);
}

export function shouldRetryWrite(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_WRITE_RETRIES && isRetryableError(error);
}
