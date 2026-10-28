import {
  type BadgeCardData,
  drawLettering,
  LETTERING_SIZE,
  maskFromImageData,
} from "@/lib/badge/layout";
import { type Canvas2D, create2dCanvas, get2dContext } from "@/lib/badge/canvas";
import type { BadgeTemplate } from "@/lib/badge/templates";

export type Lettering = { template: BadgeTemplate; canvas: Canvas2D; mask: Uint8Array };

async function loadFonts() {
  await Promise.all(
    ["600 16px Geist", "400 16px Geist", '400 16px "Geist Mono"'].map((f) =>
      document.fonts.load(f),
    ),
  ).catch(() => undefined);
}

async function loadLogo(url: string): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await createImageBitmap(await res.blob());
  } catch {
    return null;
  }
}

export async function buildLettering(
  template: BadgeTemplate,
  data: BadgeCardData,
  logoUrl: string | null,
): Promise<Lettering> {
  const [, logo] = await Promise.all([
    loadFonts(),
    template === "branded" && logoUrl ? loadLogo(logoUrl) : null,
  ]);
  const [W, H] = LETTERING_SIZE;
  const canvas = create2dCanvas(W, H);
  const ctx = get2dContext(canvas);
  if (!ctx) throw new Error("Couldn't get a 2D canvas context");
  drawLettering(ctx, template, data, { logo });
  logo?.close();
  return { template, canvas, mask: maskFromImageData(ctx.getImageData(0, 0, W, H)) };
}
