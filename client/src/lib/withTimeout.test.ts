import { describe, expect, it } from "bun:test";
import { ApiError, NetworkError, RequestTimeoutError } from "./errors";
import { withTimeout } from "./withTimeout";

// Behaves like fetch: rejects on abort, including a signal that is already
// aborted when the work starts.
const never = (signal: AbortSignal) =>
  new Promise<never>((_resolve, reject) => {
    const abort = () => reject(new DOMException("aborted", "AbortError"));
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort);
  });

describe("withTimeout", () => {
  it("returns the result when the work finishes in time", async () => {
    await expect(withTimeout(async () => 42, { timeoutMs: 100 })).resolves.toBe(42);
  });

  it("rejects with RequestTimeoutError and aborts the work when the deadline passes", async () => {
    let aborted = false;
    const run = (signal: AbortSignal) => {
      signal.addEventListener("abort", () => {
        aborted = true;
      });
      return never(signal);
    };

    const error = await withTimeout(run, { timeoutMs: 30 }).catch((e) => e);

    expect(error).toBeInstanceOf(RequestTimeoutError);
    expect(error.timeoutMs).toBe(30);
    expect(aborted).toBe(true);
  });

  it("reports fetch-style TypeErrors as NetworkError and keeps the cause", async () => {
    const cause = new TypeError("Failed to fetch");
    const error = await withTimeout(async () => {
      throw cause;
    }).catch((e) => e);

    expect(error).toBeInstanceOf(NetworkError);
    expect(error.cause).toBe(cause);
  });

  it("passes other errors through untouched", async () => {
    const apiError = new ApiError(409, "dup");
    const error = await withTimeout(async () => {
      throw apiError;
    }).catch((e) => e);

    expect(error).toBe(apiError);
  });

  it("passes through an abort the caller asked for instead of calling it a timeout", async () => {
    const outside = new AbortController();
    const pending = withTimeout((signal) => never(signal), {
      timeoutMs: 1_000,
      signal: outside.signal,
    }).catch((e) => e);

    outside.abort();
    const error = await pending;

    expect(error).toBeInstanceOf(DOMException);
    expect(error).not.toBeInstanceOf(RequestTimeoutError);
  });

  it("aborts immediately when the outside signal is already aborted", async () => {
    const outside = new AbortController();
    outside.abort();

    const error = await withTimeout((signal) => never(signal), {
      timeoutMs: 1_000,
      signal: outside.signal,
    }).catch((e) => e);

    expect(error).not.toBeInstanceOf(RequestTimeoutError);
  });

  it("does not fire the deadline after the work has finished", async () => {
    let aborted = false;
    await withTimeout(
      async (signal) => {
        signal.addEventListener("abort", () => {
          aborted = true;
        });
        return "done";
      },
      { timeoutMs: 20 },
    );
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(aborted).toBe(false);
  });
});
