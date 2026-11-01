import { NetworkError, RequestTimeoutError } from "./errors";

// Long enough to ride out a free-tier server waking up (retries add more),
// short enough that a dead connection can't leave the UI waiting for minutes.
export const REQUEST_TIMEOUT_MS = 20_000;

interface WithTimeoutOptions {
  timeoutMs?: number;
  /** An outside signal (for example React Query cancelling a request). */
  signal?: AbortSignal | undefined;
}

/**
 * Runs network I/O with a deadline. Keep only I/O inside `run`: any TypeError
 * thrown there is reported as a NetworkError, so parsing and other app logic
 * belongs outside.
 */
export async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  options: WithTimeoutOptions = {},
): Promise<T> {
  const { timeoutMs = REQUEST_TIMEOUT_MS, signal: outside } = options;
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const forwardAbort = () => controller.abort();
  if (outside?.aborted) {
    controller.abort();
  } else {
    outside?.addEventListener("abort", forwardAbort, { once: true });
  }

  try {
    return await run(controller.signal);
  } catch (error) {
    if (timedOut) throw new RequestTimeoutError(timeoutMs);
    // The caller cancelled on purpose: pass that through untouched.
    if (outside?.aborted) throw error;
    if (error instanceof TypeError) throw new NetworkError({ cause: error });
    throw error;
  } finally {
    clearTimeout(timer);
    outside?.removeEventListener("abort", forwardAbort);
  }
}
