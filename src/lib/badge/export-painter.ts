import { createHoloRenderer } from "@/components/badge/holo-renderer";
import { create2dCanvas, get2dContext } from "@/lib/badge/canvas";
import { drawFlatBadge } from "@/lib/badge/flat";
import type { Lettering } from "@/lib/badge/lettering";
import type { Pose } from "@/lib/badge/pose";

export type PaintBackend = "webgpu" | "flat";

// Draws onto a 2D canvas, so consumers can read pixels or await between frames.
// `setLettering` swaps the person on the card without rebuilding the GPU renderer.
export async function exportPainter(
  backend: PaintBackend,
  lettering: Lettering,
  accent: string,
  width: number,
  height: number,
) {
  const out = create2dCanvas(width, height);
  const ctx = get2dContext(out);
  if (!ctx) throw new Error("Couldn't get a 2D canvas context");
  if (backend === "flat") {
    const draw = (l: Lettering) => drawFlatBadge(ctx, width, height, l.template, accent, l.canvas);
    draw(lettering);
    return { out, paint: (_pose: Pose) => {}, setLettering: draw, dispose: () => {} };
  }
  const gpuCanvas = new OffscreenCanvas(width, height);
  const renderer = await createHoloRenderer(gpuCanvas);
  const setLettering = (l: Lettering) =>
    renderer.setScene({ template: l.template, accent, mask: l.mask });
  setLettering(lettering);
  return {
    out,
    paint: (pose: Pose) => {
      renderer.draw(pose);
      ctx.drawImage(gpuCanvas, 0, 0);
    },
    setLettering,
    dispose: () => renderer.dispose(),
  };
}
