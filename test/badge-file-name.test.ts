import { describe, expect, it } from "vitest";
import { badgeFileName } from "../src/lib/badge/file-name";

describe("badgeFileName", () => {
  it("slugs the name and appends the event code", () => {
    expect(badgeFileName("Ana", "Cruz", "devfest", "png")).toBe("ana-cruz-devfest.png");
  });

  it("strips diacritics", () => {
    expect(badgeFileName("José", "Ñuñez", "devfest", "png")).toBe("jose-nunez-devfest.png");
  });

  it("falls back to badge when nothing survives", () => {
    expect(badgeFileName("李", "雷", "x", "gif")).toBe("badge-x.gif");
  });

  it("cuts long names to 40 chars without a trailing dash", () => {
    const name = badgeFileName("a".repeat(39), "b".repeat(60), "x", "png");
    expect(name).toBe(`${"a".repeat(39)}-x.png`);
    expect(badgeFileName("a".repeat(100), "", "x", "png")).toBe(`${"a".repeat(40)}-x.png`);
  });
});
