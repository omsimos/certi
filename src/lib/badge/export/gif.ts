import { applyPalette, GIFEncoder, quantize } from "gifenc";

import { get2dContext } from "@/lib/badge/canvas";
import { frameTimes } from "@/lib/badge/pose";

import type { BadgeHandle, ExportOptions } from "./types";

const W = 540;
const H = 768;
const FPS = 20;
const SECONDS = 4;

export async function exportGif(
  handle: BadgeHandle,
  { signal, onProgress }: ExportOptions = {},
): Promise<Blob> {
  const gif = GIFEncoder();
  const times = frameTimes(SECONDS, FPS);
  await handle.renderFrames({
    width: W,
    height: H,
    times,
    signal,
    async onFrame(canvas, i) {
      const ctx = get2dContext(canvas);
      if (!ctx) throw new Error("Couldn't read the frame");
      const { data } = ctx.getImageData(0, 0, W, H);
      // A palette per frame: the foil shifts hue, so one shared palette bands badly.
      const palette = quantize(data, 256);
      gif.writeFrame(applyPalette(data, palette), W, H, {
        palette,
        delay: 1000 / FPS,
        repeat: 0,
      });
      onProgress?.((i + 1) / times.length);
    },
  });
  gif.finish();
  return new Blob([gif.bytes() as BlobPart], { type: "image/gif" });
}
