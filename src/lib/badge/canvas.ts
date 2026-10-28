export type Canvas2D = OffscreenCanvas | HTMLCanvasElement;

// Safari before 16.4 has no OffscreenCanvas, and those are exactly the browsers on the
// flat fallback, so they get a detached DOM canvas instead.
export function create2dCanvas(width: number, height: number): Canvas2D {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function get2dContext(canvas: Canvas2D) {
  return canvas.getContext("2d") as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
}

export function canvasToBlob(
  canvas: Canvas2D,
  o: { type: string; quality?: number },
): Promise<Blob> {
  if ("convertToBlob" in canvas) return canvas.convertToBlob(o);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't encode the image"))),
      o.type,
      o.quality,
    ),
  );
}
