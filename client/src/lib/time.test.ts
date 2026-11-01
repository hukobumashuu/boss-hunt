import { describe, expect, it } from "bun:test";
import { formatAge } from "./time";

describe("formatAge", () => {
  it("describes ages at every scale", () => {
    expect(formatAge(0)).toBe("just now");
    expect(formatAge(4_000)).toBe("just now");
    expect(formatAge(42_000)).toBe("42s ago");
    expect(formatAge(5 * 60_000)).toBe("5m ago");
    expect(formatAge(59 * 60_000 + 59_000)).toBe("59m ago");
    expect(formatAge(2 * 3_600_000 + 10 * 60_000)).toBe("2h 10m ago");
  });

  it("treats a negative age (clock skew) as just now", () => {
    expect(formatAge(-30_000)).toBe("just now");
  });
});
