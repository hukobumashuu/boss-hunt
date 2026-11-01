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

/** The server accepted the connection but did not answer in time. */
export class RequestTimeoutError extends Error {
  constructor(public readonly timeoutMs: number) {
    super(
      `The server didn't answer within ${Math.round(timeoutMs / 1000)} seconds.`,
    );
    this.name = "RequestTimeoutError";
  }
}

/** The request never got a response (offline, DNS, connection reset). */
export class NetworkError extends Error {
  constructor(options?: ErrorOptions) {
    super("Can't reach the server.", options);
    this.name = "NetworkError";
  }
}

// 500/502/503/504 are usually a restarting or overloaded server, so a retry can
// succeed. 4xx (bad input, auth, rate limit, duplicate warning) never will.
const RETRYABLE_STATUSES: ReadonlySet<number> = new Set([500, 502, 503, 504]);

export function isRetryableError(error: unknown): boolean {
  if (error instanceof RequestTimeoutError || error instanceof NetworkError) {
    return true;
  }
  return error instanceof ApiError && RETRYABLE_STATUSES.has(error.status);
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof RequestTimeoutError) {
    return "The server is taking too long to respond.";
  }
  if (error instanceof NetworkError) {
    return "Can't reach the server. Check your connection.";
  }
  if (error instanceof ApiError) {
    return error.status >= 500
      ? "The server is having trouble. Try again in a moment."
      : error.message;
  }
  return fallback;
}
