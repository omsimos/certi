import * as THREE from "three";

type Attendee = { firstName: string; lastName: string };

const SIZE = 2048;
const FONT_FAMILY = "Geist, ui-sans-serif, system-ui, sans-serif";
const DOMAIN = "omsimos.com";

/*
 * The layout replays the old RenderTexture scene so the card face looks the same. That scene had
 * three Text3D lines (positions, sizes and letter spacing in world units) wrapped in drei's
 * <Center><Resize>, filmed by a camera with fov 50 and aspect 1.05 at (0.49, 0.22, 2).
 *
 * The card's glTF UVs put the image's top row at v = 0, while a render target stores its bottom
 * row there, so the old scene mirrored its text vertically to land upright. Here the canvas is
 * uploaded unflipped (glTF convention), so world y maps straight to canvas y, growing downwards.
 */
const LINES = [
  { pick: (a: Attendee) => a.firstName, x: 1.05, y: 2.1, size: 0.15, letterSpacing: -0.02 },
  { pick: (a: Attendee) => a.lastName, x: 1.23, y: 2.3, size: 0.15, letterSpacing: -0.02 },
  { pick: () => DOMAIN, x: 1.3, y: 3.25, size: 0.07, letterSpacing: -0.008 },
];
const VIEW_HALF_HEIGHT = Math.tan(THREE.MathUtils.degToRad(25)) * 2;
const VIEW_HALF_WIDTH = VIEW_HALF_HEIGHT * 1.05;
const VIEW_CENTER_X = 0.49;
const VIEW_CENTER_Y = 0.22;
// Canvas pixels per world unit. The two differ because the old camera's aspect didn't match its square target.
const PX_PER_UNIT_X = SIZE / (2 * VIEW_HALF_WIDTH);
const PX_PER_UNIT_Y = SIZE / (2 * VIEW_HALF_HEIGHT);
const MEASURE_PX = 100;

function font(px: number) {
  return `400 ${px}px ${FONT_FAMILY}`;
}

/** Glyph-by-glyph advances: Text3D applied letter spacing per glyph and never kerned. */
function advances(ctx: CanvasRenderingContext2D, chars: string[], letterSpacing: number) {
  return chars.map((ch) => ctx.measureText(ch).width + letterSpacing);
}

function drawBadge(ctx: CanvasRenderingContext2D, attendee: Attendee) {
  const lines = LINES.map((line) => ({ ...line, chars: Array.from(line.pick(attendee).trim()) }));

  // World-space bounds of the visible glyphs, as drei's Resize/Center measured them.
  ctx.font = font(MEASURE_PX);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const line of lines) {
    if (line.chars.length === 0) continue;
    const toWorld = line.size / MEASURE_PX;
    const steps = advances(ctx, line.chars, line.letterSpacing / toWorld);
    const first = ctx.measureText(line.chars[0]);
    const last = ctx.measureText(line.chars[line.chars.length - 1]);
    const whole = ctx.measureText(line.chars.join(""));
    const lastStart = steps.slice(0, -1).reduce((sum, step) => sum + step, 0);
    minX = Math.min(minX, line.x - first.actualBoundingBoxLeft * toWorld);
    maxX = Math.max(maxX, line.x + (lastStart + last.actualBoundingBoxRight) * toWorld);
    minY = Math.min(minY, line.y - whole.actualBoundingBoxAscent * toWorld);
    maxY = Math.max(maxY, line.y + whole.actualBoundingBoxDescent * toWorld);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, SIZE, SIZE);
  if (minX === Infinity) return;

  const scale = 1 / Math.max(maxX - minX, maxY - minY);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const toCanvasX = (x: number) =>
    SIZE / 2 + (scale * (x - centerX) - VIEW_CENTER_X) * PX_PER_UNIT_X;
  const toCanvasY = (y: number) =>
    SIZE / 2 + (scale * (y - centerY) - VIEW_CENTER_Y) * PX_PER_UNIT_Y;

  // Text is set at the vertical pixel density and squeezed horizontally, rather than at a tiny
  // font size under a large transform, which some browsers rasterise badly.
  const squeeze = PX_PER_UNIT_X / PX_PER_UNIT_Y;
  ctx.setTransform(squeeze, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  for (const line of lines) {
    if (line.chars.length === 0) continue;
    const unit = scale * PX_PER_UNIT_Y;
    ctx.font = font(line.size * unit);
    const steps = advances(ctx, line.chars, line.letterSpacing * unit);
    let x = toCanvasX(line.x) / squeeze;
    const y = toCanvasY(line.y);
    line.chars.forEach((ch, i) => {
      ctx.fillText(ch, x, y);
      x += steps[i];
    });
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/**
 * The badge card's face: name and domain drawn with the 2D canvas API, which works on any
 * renderer backend. It draws at once with whatever font is ready, then redraws once Geist loads.
 */
export function createBadgeTexture(attendee: Attendee): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  // The card's UVs follow glTF, which expects images unflipped.
  texture.flipY = false;

  drawBadge(ctx, attendee);

  const text = `${attendee.firstName}${attendee.lastName}${DOMAIN}`;
  const spec = font(MEASURE_PX);
  if (!document.fonts.check(spec, text)) {
    // A redraw after dispose() is harmless: three re-uploads a disposed texture only if it's used again.
    document.fonts
      .load(spec, text)
      .then((faces) => {
        if (faces.length === 0) return;
        drawBadge(ctx, attendee);
        texture.needsUpdate = true;
      })
      .catch(() => {
        // The fallback font drawn above stays.
      });
  }

  return texture;
}
