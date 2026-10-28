import { describe, expect, it } from "vitest";
import { requireEnv } from "../src/lib/env";

describe("requireEnv", () => {
  it("returns a present value in dev and prod", () => {
    expect(requireEnv("X", "abc", true)).toBe("abc");
    expect(requireEnv("X", "abc", false)).toBe("abc");
  });

  it("returns undefined when missing in dev", () => {
    expect(requireEnv("X", undefined, true)).toBeUndefined();
    expect(requireEnv("X", "", true)).toBeUndefined();
  });

  it("throws when missing outside dev", () => {
    expect(() => requireEnv("BETTER_AUTH_SECRET", undefined, false)).toThrow(
      "BETTER_AUTH_SECRET is not set",
    );
    expect(() => requireEnv("BETTER_AUTH_URL", "", false)).toThrow("BETTER_AUTH_URL is not set");
  });
});
