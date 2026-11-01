// A "kill intent" is one tap on "Log kill". It remembers WHEN the user tapped
// and carries one idempotency key, so a delayed confirmation or a retry still
// records the real kill time and can never log the kill twice.

// Keep in sync with MAX_KILL_AGE_MS in server/src/shared/utils/constants.ts.
export const MAX_KILL_AGE_MS = 30 * 60 * 1000;

// After this long, tapping again is treated as a new kill, not a retry.
export const INTENT_TTL_MS = 10 * 60 * 1000;

export interface KillIntent {
  bossId: number;
  channel: number;
  /** Date.now() at the moment of the tap. */
  tappedAt: number;
  requestId: string;
}

function toHex(byte: number): string {
  return byte.toString(16).padStart(2, "0");
}

/** Formats 16 random bytes as an RFC 4122 version-4 UUID. */
export function formatUuidV4(random: Uint8Array): string {
  const bytes = Uint8Array.from(random);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, toHex).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

export function generateRequestId(): string {
  // randomUUID only exists in secure contexts (https or localhost).
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return formatUuidV4(crypto.getRandomValues(new Uint8Array(16)));
}

export function createKillIntent(
  bossId: number,
  channel: number,
  now: number = Date.now(),
): KillIntent {
  return { bossId, channel, tappedAt: now, requestId: generateRequestId() };
}

/**
 * Re-tapping the same boss and channel soon after a failed attempt continues
 * the original intent (same tap time, same key). Anything else starts fresh.
 */
export function reuseOrCreateKillIntent(
  existing: KillIntent | null,
  bossId: number,
  channel: number,
  now: number = Date.now(),
): KillIntent {
  if (
    existing &&
    existing.bossId === bossId &&
    existing.channel === channel &&
    now - existing.tappedAt < INTENT_TTL_MS
  ) {
    return existing;
  }
  return createKillIntent(bossId, channel, now);
}

/** How long ago the tap was, as the whole non-negative ms the server expects. */
export function killAgeMs(intent: KillIntent, now: number = Date.now()): number {
  const age = Math.round(now - intent.tappedAt);
  return Math.min(Math.max(age, 0), MAX_KILL_AGE_MS);
}
