import { describe, expect, it } from "bun:test";
import {
  ApiError,
  NetworkError,
  RequestTimeoutError,
  getErrorMessage,
  isRetryableError,
} from "./errors";

describe("isRetryableError", () => {
  it("retries timeouts and network failures", () => {
    expect(isRetryableError(new RequestTimeoutError(20_000))).toBe(true);
    expect(isRetryableError(new NetworkError())).toBe(true);
  });

  it("retries server-side failures", () => {
    for (const status of [500, 502, 503, 504]) {
      expect(isRetryableError(new ApiError(status, "x"))).toBe(true);
    }
  });

  it("never retries client errors, including the duplicate warning", () => {
    for (const status of [400, 401, 403, 404, 409, 429]) {
      expect(isRetryableError(new ApiError(status, "x"))).toBe(false);
    }
  });

  it("does not retry unknown errors", () => {
    expect(isRetryableError(new Error("bug"))).toBe(false);
    expect(isRetryableError("nope")).toBe(false);
  });
});

describe("getErrorMessage", () => {
  it("explains timeouts and network failures in plain words", () => {
    expect(getErrorMessage(new RequestTimeoutError(20_000), "f")).toContain(
      "taking too long",
    );
    expect(getErrorMessage(new NetworkError(), "f")).toContain("Can't reach");
  });

  it("hides raw server error text for 5xx but keeps useful 4xx messages", () => {
    expect(getErrorMessage(new ApiError(500, "Internal server error"), "f")).not.toContain(
      "Internal",
    );
    expect(getErrorMessage(new ApiError(429, "Too many requests"), "f")).toBe(
      "Too many requests",
    );
  });

  it("falls back for unknown errors", () => {
    expect(getErrorMessage(new Error("x"), "fallback")).toBe("fallback");
  });
});
