import { BufferTarget, CanvasSource, Mp4OutputFormat, Output } from "mediabunny";

import { frameTimes } from "@/lib/badge/pose";

import type { BadgeHandle, ExportOptions } from "./types";

const W = 1080;
const H = 1536;
const FPS = 30;
const SECONDS = 4;

export async function exportMp4(
  handle: BadgeHandle,
  { signal, onProgress }: ExportOptions = {},
): Promise<Blob> {
  // renderFrames hands over a fresh canvas per frame; CanvasSource needs one stable canvas.
  const stage = new OffscreenCanvas(W, H);
  const ctx = stage.getContext("2d");
  if (!ctx) throw new Error("Couldn't start the video encoder");

  const output = new Output({ format: new Mp4OutputFormat(), target: new BufferTarget() });
  const source = new CanvasSource(stage, { codec: "avc", bitrate: 8_000_000 });
  output.addVideoTrack(source, { frameRate: FPS });
  await output.start();

  const times = frameTimes(SECONDS, FPS);
  try {
    await handle.renderFrames({
      width: W,
      height: H,
      times,
      signal,
      async onFrame(canvas, i) {
        ctx.drawImage(canvas, 0, 0);
        await source.add(i / FPS, 1 / FPS);
        onProgress?.((i + 1) / times.length);
      },
    });
    await output.finalize();
  } catch (e) {
    await output.cancel();
    throw e;
  }
  return new Blob([output.target.buffer!], { type: "video/mp4" });
}
