import { describe, expect, it } from "bun:test";
import {
  INTENT_TTL_MS,
  MAX_KILL_AGE_MS,
  createKillIntent,
  formatUuidV4,
  generateRequestId,
  killAgeMs,
  reuseOrCreateKillIntent,
} from "./killIntent";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("request ids", () => {
  it("generates RFC 4122 v4 UUIDs", () => {
    expect(generateRequestId()).toMatch(UUID_V4);
  });

  it("formats any 16 bytes (the non-secure-context fallback) as a valid v4 UUID", () => {
    expect(formatUuidV4(new Uint8Array(16))).toBe("00000000-0000-4000-8000-000000000000");
    expect(formatUuidV4(new Uint8Array(16).fill(255))).toMatch(UUID_V4);
  });

  it("does not modify the bytes it is given", () => {
    const bytes = new Uint8Array(16).fill(255);
    formatUuidV4(bytes);
    expect(Array.from(bytes).every((b) => b === 255)).toBe(true);
  });

  it("gives every new intent its own key", () => {
    expect(createKillIntent(1, 2).requestId).not.toBe(createKillIntent(1, 2).requestId);
  });
});

describe("reuseOrCreateKillIntent", () => {
  const t0 = 1_000_000;

  it("continues the same intent when the same channel is tapped again soon", () => {
    const first = createKillIntent(1, 5, t0);
    const again = reuseOrCreateKillIntent(first, 1, 5, t0 + 60_000);

    expect(again).toBe(first);
  });

  it("starts a new intent for a different boss or channel", () => {
    const first = createKillIntent(1, 5, t0);

    expect(reuseOrCreateKillIntent(first, 2, 5, t0 + 1000)).not.toBe(first);
    expect(reuseOrCreateKillIntent(first, 1, 6, t0 + 1000)).not.toBe(first);
  });

  it("starts a new intent once the old one has expired", () => {
    const first = createKillIntent(1, 5, t0);
    const later = reuseOrCreateKillIntent(first, 1, 5, t0 + INTENT_TTL_MS);

    expect(later).not.toBe(first);
    expect(later.tappedAt).toBe(t0 + INTENT_TTL_MS);
  });

  it("creates an intent when there is none", () => {
    expect(reuseOrCreateKillIntent(null, 1, 5, t0).tappedAt).toBe(t0);
  });
});

describe("killAgeMs", () => {
  const intent = createKillIntent(1, 5, 1_000_000);

  it("is how long ago the tap was", () => {
    expect(killAgeMs(intent, 1_000_000)).toBe(0);
    expect(killAgeMs(intent, 1_000_000 + 5 * 60_000)).toBe(300_000);
  });

  it("rounds to a whole number of milliseconds, as the server requires", () => {
    expect(Number.isInteger(killAgeMs(intent, 1_000_000.6))).toBe(true);
  });

  it("is never negative, even if the clock moved backwards", () => {
    expect(killAgeMs(intent, 999_000)).toBe(0);
  });

  it("never exceeds the maximum the server accepts", () => {
    expect(killAgeMs(intent, 1_000_000 + 3 * 60 * 60_000)).toBe(MAX_KILL_AGE_MS);
  });
});
