import { create2dCanvas, get2dContext } from "./canvas";
import { CARD_HALF, cardRect } from "./layout";
import type { BadgeTemplate } from "./templates";

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const BACKGROUND = "#090a0c";
// The shader's matte graphite base, vec3f(0.062, 0.068, 0.078).
const GRAPHITE = "rgb(16, 17, 20)";
const OUTLINE = "#4a5260";
const LETTERING = "#c4c9d1";
const CARD_RADIUS = 0.055;
const TRIANGLE_HALF_WIDTH = 0.38;

// Branded cards use the shader's accent.rgb * 0.34 in place of graphite.
function accentFill(accent: string) {
  const [r, g, b] = [1, 3, 5].map((i) => Math.round(parseInt(accent.slice(i, i + 2), 16) * 0.34));
  return `rgb(${r}, ${g}, ${b})`;
}

// A static stand-in for the holographic badge, for browsers without WebGPU and simple email images.
export function drawFlatBadge(
  ctx: Ctx,
  width: number,
  height: number,
  template: BadgeTemplate,
  accent: string,
  lettering: CanvasImageSource,
): void {
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, width, height);

  const card = cardRect(width, height);
  // Pixels per card unit.
  const unit = card.w / (CARD_HALF[0] * 2);
  const cx = card.x + card.w / 2;
  const cy = card.y + card.h / 2;

  ctx.beginPath();
  ctx.roundRect(card.x, card.y, card.w, card.h, CARD_RADIUS * unit);
  ctx.fillStyle = template === "branded" ? accentFill(accent) : GRAPHITE;
  ctx.fill();

  if (template !== "id") {
    // Same equilateral triangle as the shader, centered on its centroid.
    const half = TRIANGLE_HALF_WIDTH;
    const h = half * Math.sqrt(3);
    ctx.beginPath();
    ctx.moveTo(cx, cy - ((h * 2) / 3) * unit);
    ctx.lineTo(cx - half * unit, cy + (h / 3) * unit);
    ctx.lineTo(cx + half * unit, cy + (h / 3) * unit);
    ctx.closePath();
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = Math.max(1, 0.003 * unit);
    ctx.stroke();
  }

  // The lettering is a white alpha mask; recolor it on its own layer so the card stays untouched.
  const tw = Math.max(1, Math.ceil(card.w));
  const th = Math.max(1, Math.ceil(card.h));
  const layer = create2dCanvas(tw, th);
  const lctx = get2dContext(layer);
  if (!lctx) return;
  lctx.drawImage(lettering, 0, 0, tw, th);
  lctx.globalCompositeOperation = "source-in";
  lctx.fillStyle = LETTERING;
  lctx.fillRect(0, 0, tw, th);
  ctx.drawImage(layer, card.x, card.y, card.w, card.h);
}
