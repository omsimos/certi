import { describe, expect, it } from "vitest";
import { safeRedirect } from "../src/lib/redirect";

describe("safeRedirect", () => {
  it("keeps same-origin relative paths", () => {
    expect(safeRedirect("/dashboard/new")).toBe("/dashboard/new");
    expect(safeRedirect("/dashboard?tab=details#x")).toBe("/dashboard?tab=details#x");
  });

  it.each([
    "//evil.com",
    "https://evil.com",
    "http://evil.com/dashboard",
    "javascript:alert(1)",
    "/\\evil.com",
    "\\\\evil.com",
    "/\t/evil.com",
    "dashboard",
    "",
    "  /dashboard",
  ])("rejects %j", (value) => {
    expect(safeRedirect(value)).toBe("/dashboard");
  });

  it("rejects non-strings", () => {
    expect(safeRedirect(undefined)).toBe("/dashboard");
    expect(safeRedirect(null)).toBe("/dashboard");
    expect(safeRedirect(42)).toBe("/dashboard");
    expect(safeRedirect({})).toBe("/dashboard");
  });
});
