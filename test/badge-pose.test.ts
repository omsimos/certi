import { describe, expect, it } from "vitest";
import { frameTimes, pointerToCard, sweepPose } from "../src/lib/badge/pose";

describe("sweepPose", () => {
  it("loops seamlessly", () => {
    const a = sweepPose(0);
    const b = sweepPose(1);
    expect(a.hover).toBe(0.8);
    for (const i of [0, 1] as const) {
      expect(a.tilt[i]).toBeCloseTo(b.tilt[i], 9);
      expect(a.pointer[i]).toBeCloseTo(b.pointer[i], 9);
    }
  });
});

describe("frameTimes", () => {
  it("returns seconds * fps phases in [0, 1)", () => {
    const t = frameTimes(4, 30);
    expect(t).toHaveLength(120);
    expect(t[0]).toBe(0);
    expect(t[119]).toBeLessThan(1);
  });
});

describe("pointerToCard", () => {
  const rect = { left: 100, top: 50, width: 400, height: 560 };
  it("is neutral with full hover at the center", () => {
    expect(pointerToCard(300, 330, rect)).toEqual({ x: 0, y: 0, hover: 1 });
  });
  it("has no hover far outside", () => {
    expect(pointerToCard(5000, 5000, rect).hover).toBe(0);
  });
});
