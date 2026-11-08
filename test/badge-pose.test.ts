import { describe, expect, it } from "vitest";
import {
  applyOffset,
  createBadgeControl,
  frameTimes,
  pointerToCard,
  type Pose,
  sweepPose,
} from "../src/lib/badge/pose";

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

describe("applyOffset", () => {
  const pose: Pose = { tilt: [0.1, -0.05], pointer: [0.3, -0.2], hover: 0.8 };
  it("returns an equal pose for the identity offset", () => {
    expect(applyOffset(pose, createBadgeControl().offset)).toEqual(pose);
  });
  it("adds tilt", () => {
    const p = applyOffset(pose, { tiltX: 1, tiltY: -0.3, hover: 1 });
    expect(p.tilt[0]).toBeCloseTo(1.1, 9);
    expect(p.tilt[1]).toBeCloseTo(-0.35, 9);
    expect(p.pointer).toEqual(pose.pointer);
  });
  it("multiplies hover", () => {
    expect(applyOffset(pose, { tiltX: 0, tiltY: 0, hover: 0.5 }).hover).toBeCloseTo(0.4, 9);
    expect(applyOffset(pose, { tiltX: 0, tiltY: 0, hover: 0 }).hover).toBe(0);
  });
});
