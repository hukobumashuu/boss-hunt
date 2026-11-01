import { describe, expect, it } from "bun:test";
import { ApiError, NetworkError } from "./errors";
import {
  MAX_QUERY_RETRIES,
  MAX_WRITE_RETRIES,
  retryDelayMs,
  shouldRetryQuery,
  shouldRetryWrite,
} from "./retry";

describe("retry policy", () => {
  it("backs off 1s, 2s, then caps at 4s", () => {
    expect([0, 1, 2, 3, 10].map(retryDelayMs)).toEqual([1000, 2000, 4000, 4000, 4000]);
  });

  it("retries reads up to the limit, for retryable errors only", () => {
    const retryable = new NetworkError();
    expect(shouldRetryQuery(0, retryable)).toBe(true);
    expect(shouldRetryQuery(MAX_QUERY_RETRIES - 1, retryable)).toBe(true);
    expect(shouldRetryQuery(MAX_QUERY_RETRIES, retryable)).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(401, "no"))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(429, "slow down"))).toBe(false);
  });

  it("retries writes once, and never a duplicate warning", () => {
    const retryable = new ApiError(503, "x");
    expect(shouldRetryWrite(0, retryable)).toBe(true);
    expect(shouldRetryWrite(MAX_WRITE_RETRIES, retryable)).toBe(false);
    expect(shouldRetryWrite(0, new ApiError(409, "dup"))).toBe(false);
  });
});
