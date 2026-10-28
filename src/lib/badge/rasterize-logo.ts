import { MAX_LOGO_BYTES } from "@/lib/badge/logo-limits";

const MAX_SIDE = 512;

async function loadSvg(file: File): Promise<{ source: CanvasImageSource; w: number; h: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    // An SVG without width/height reports 0; draw it at the max size instead.
    return { source: img, w: img.naturalWidth || MAX_SIDE, h: img.naturalHeight || MAX_SIDE };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Draws the image contained in a canvas of at most 512x512 and encodes it as PNG, so the
// server never has to parse or sanitize user-supplied formats (SVG in particular).
export async function rasterizeLogo(file: File): Promise<Blob> {
  let source: CanvasImageSource;
  let w: number;
  let h: number;
  let close = () => {};
  if (file.type === "image/svg+xml") {
    ({ source, w, h } = await loadSvg(file));
  } else {
    // createImageBitmap on SVG blobs is unreliable, hence the split above.
    const bitmap = await createImageBitmap(file);
    ({ width: w, height: h } = bitmap);
    source = bitmap;
    close = () => bitmap.close();
  }
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't get a 2D canvas context");
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Couldn't encode the logo");
    if (blob.size > MAX_LOGO_BYTES) throw new LogoTooLargeError();
    return blob;
  } finally {
    close();
  }
}

export class LogoTooLargeError extends Error {
  override name = "LogoTooLargeError";
}
