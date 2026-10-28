import { frameTimes } from "@/lib/badge/pose";

import type { BadgeHandle, ExportOptions } from "./types";
import { muxAnimatedWebp } from "./webp-mux";

const W = 720;
const H = 1024;
const FPS = 24;
const SECONDS = 4;

export const canExportWebp = async (): Promise<boolean> => {
  try {
    if (typeof OffscreenCanvas === "undefined") return false;
    const blob = await new OffscreenCanvas(2, 2).convertToBlob({ type: "image/webp" });
    return blob.type === "image/webp";
  } catch {
    return false;
  }
};

export async function exportWebp(
  handle: BadgeHandle,
  { signal, onProgress }: ExportOptions = {},
): Promise<Blob> {
  const frames: Uint8Array[] = [];
  const times = frameTimes(SECONDS, FPS);
  await handle.renderFrames({
    width: W,
    height: H,
    times,
    signal,
    async onFrame(canvas, i) {
      const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.9 });
      frames.push(new Uint8Array(await blob.arrayBuffer()));
      onProgress?.((i + 1) / times.length);
    },
  });
  // 1000 / 24 = 41.67 ms; WebP durations are whole milliseconds.
  const out = muxAnimatedWebp(frames, { width: W, height: H, frameMs: 42 });
  return new Blob([out as BlobPart], { type: "image/webp" });
}
