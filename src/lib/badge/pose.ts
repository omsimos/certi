import { CARD_HALF, VIEW_UNITS } from "./layout";

export type Pose = {
  tilt: [number, number];
  pointer: [number, number];
  hover: number;
};

export const STILL_POSE: Pose = {
  tilt: [0.045, -0.035],
  pointer: [0.25, -0.25],
  hover: 0.85,
};

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

export function poseFromPointer(x: number, y: number, hover: number): Pose {
  return {
    tilt: [clamp1(x) * 0.16 * hover, -clamp1(y) * 0.12 * hover],
    pointer: [x, y],
    hover,
  };
}

// Integer cycle counts (1 and 2) per loop make phase 0 and 1 identical.
export function sweepPose(phase: number): Pose {
  const a = 2 * Math.PI * phase;
  return poseFromPointer(Math.sin(a) * 0.85, Math.cos(2 * a) * 0.7, 0.8);
}

// Mirrors vgpu's renderer.ts move(): pointer in card units, foil reveals on approach.
export function pointerToCard(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): { x: number; y: number; hover: number } {
  const scale = Math.max(1, Math.min(rect.height, rect.width * 1.35));
  const x = (((clientX - rect.left - rect.width / 2) / scale) * VIEW_UNITS) / CARD_HALF[0];
  const y = (((clientY - rect.top - rect.height / 2) / scale) * VIEW_UNITS) / CARD_HALF[1];
  const dx = (Math.max(0, Math.abs(x) - 1) * scale * CARD_HALF[0]) / VIEW_UNITS;
  const dy = (Math.max(0, Math.abs(y) - 1) * scale * CARD_HALF[1]) / VIEW_UNITS;
  const p = Math.max(0, 1 - Math.hypot(dx, dy) / ((scale * 2 * CARD_HALF[0]) / VIEW_UNITS));
  return { x, y, hover: p * p * (3 - 2 * p) };
}

export function frameTimes(seconds: number, fps: number): number[] {
  const n = Math.round(seconds * fps);
  return Array.from({ length: n }, (_, k) => k / n);
}
