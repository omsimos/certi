import { qrModules } from "./qr";
import type { BadgeTemplate } from "./templates";

export const LETTERING_SIZE = [1024, 1456] as const;
export const CARD_HALF = [0.64, 0.91] as const;
export const VIEW_UNITS = 2.5;

export const FONT_SANS = 'Geist, "Noto Sans", system-ui, sans-serif';
export const FONT_MONO = '"Geist Mono", ui-monospace, monospace';

export type BadgeCardData = {
  firstName: string;
  lastName: string;
  eventTitle: string;
  organizer: string;
  date: string;
  attendeeId: string;
  badgeUrl: string;
};

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

// The card's pixel rect inside a canvas, using the shader's framing.
export function cardRect(width: number, height: number) {
  const scale = Math.min(height, width * 1.35);
  const w = ((CARD_HALF[0] * 2) / VIEW_UNITS) * scale;
  const h = ((CARD_HALF[1] * 2) / VIEW_UNITS) * scale;
  return { x: (width - w) / 2, y: (height - h) / 2, w, h };
}

type Measure = (text: string, px: number) => number;
type FitOptions = {
  maxWidth: number;
  maxPx: number;
  minPx: number;
  maxLines: 1 | 2;
};

function ellipsize(measure: Measure, line: string, px: number, maxWidth: number) {
  // Trim by code point so a surrogate pair is never cut in half.
  const chars = Array.from(line);
  while (chars.length > 0 && measure(`${chars.join("")}…`, px) > maxWidth) {
    chars.pop();
  }
  return `${chars.join("").trimEnd()}…`;
}

function splitNearMiddle(text: string): string[] | null {
  const mid = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) {
      best = i;
    }
  }
  if (best <= 0 || best >= text.length - 1) return null;
  return [text.slice(0, best), text.slice(best + 1)];
}

export function fitText(
  measure: Measure,
  text: string,
  o: FitOptions,
): { lines: string[]; px: number } {
  const sizes: number[] = [];
  for (let px = o.maxPx; px > o.minPx; px -= 4) sizes.push(px);
  sizes.push(o.minPx);

  const fits = (lines: string[], px: number) => lines.every((l) => measure(l, px) <= o.maxWidth);

  const candidates: string[][] = [[text]];
  const split = o.maxLines === 2 ? splitNearMiddle(text) : null;

  for (const px of sizes) {
    if (fits([text], px)) return { lines: [text], px };
  }
  if (split) {
    for (const px of sizes) {
      if (fits(split, px)) return { lines: split, px };
    }
    candidates.push(split);
  }

  // Nothing fits at minPx: ellipsize every line that still overflows.
  const lines = candidates[candidates.length - 1].map((l) =>
    measure(l, o.minPx) > o.maxWidth ? ellipsize(measure, l, o.minPx, o.maxWidth) : l,
  );
  return { lines, px: o.minPx };
}

export function maskFromImageData(data: ImageData): Uint8Array {
  const rgba = data.data;
  const out = new Uint8Array(rgba.length / 4);
  for (let i = 0; i < out.length; i++) out[i] = rgba[i * 4 + 3];
  return out;
}

const W = LETTERING_SIZE[0];
const HAIR = String.fromCharCode(8202);
// Hair-space letterspacing for the mono labels.
const track = (t: string) => Array.from(t.toUpperCase()).join(HAIR);

function sourceSize(img: CanvasImageSource): [number, number] {
  const i = img as {
    naturalWidth?: number;
    naturalHeight?: number;
    videoWidth?: number;
    videoHeight?: number;
    width?: number;
    height?: number;
  };
  const w = i.naturalWidth || i.videoWidth || i.width || 1;
  const h = i.naturalHeight || i.videoHeight || i.height || 1;
  return [w, h];
}

export function drawLettering(
  ctx: Ctx,
  template: BadgeTemplate,
  data: BadgeCardData,
  assets: { logo?: CanvasImageSource | null; qr?: boolean[][] | null },
): void {
  const sans = (px: number) => `600 ${px}px ${FONT_SANS}`;
  const mono = (px: number) => `400 ${px}px ${FONT_MONO}`;
  const measureAt =
    (font: (px: number) => string): Measure =>
    (t, px) => {
      ctx.font = font(px);
      return ctx.measureText(t).width;
    };
  const fit = (font: (px: number) => string, text: string, o: FitOptions) => {
    const r = fitText(measureAt(font), text, o);
    ctx.font = font(r.px);
    return r;
  };
  const text = (s: string, x: number, y: number, align: CanvasTextAlign) => {
    ctx.textAlign = align;
    ctx.fillText(s, x, y);
  };
  // One tracked mono line, shrunk or ellipsized to fit.
  const label = (
    s: string,
    x: number,
    y: number,
    align: CanvasTextAlign,
    maxWidth: number,
    maxPx = 26,
  ) => {
    const r = fit(mono, track(s), { maxWidth, maxPx, minPx: 16, maxLines: 1 });
    text(r.lines[0], x, y, align);
  };
  const nameBlock = (
    cx: number,
    firstBaseline: number,
    align: CanvasTextAlign,
    maxPx: number,
    minPx: number,
    lineGap: number,
  ) => {
    const r = fit(sans, `${data.firstName} ${data.lastName}`.trim(), {
      maxWidth: 884,
      maxPx,
      minPx,
      maxLines: 2,
    });
    r.lines.forEach((l, i) => text(l, cx, firstBaseline + i * r.px * lineGap, align));
  };

  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  ctx.textBaseline = "alphabetic";

  if (template === "graphite") {
    ctx.font = sans(66);
    text("certi.", 72, 128, "left");
    ctx.font = mono(26);
    text(track("EDITION 001"), 74, 178, "left");
    text(track("ATTENDEE"), 74, 1060, "left");
    nameBlock(70, 1160, "left", 96, 56, 1.02);
    label(data.eventTitle, 74, 1380, "left", 560);
    label(data.date, W - 74, 1380, "right", 300);
  } else if (template === "branded") {
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(72, 72, 150, 150, 34);
    ctx.stroke();
    if (assets.logo) {
      const [iw, ih] = sourceSize(assets.logo);
      const box = 126;
      const k = Math.min(box / iw, box / ih);
      ctx.drawImage(assets.logo, 72 + (150 - iw * k) / 2, 72 + (150 - ih * k) / 2, iw * k, ih * k);
    }
    const r = fit(sans, data.eventTitle, {
      maxWidth: W - 254 - 72,
      maxPx: 54,
      minPx: 32,
      maxLines: 1,
    });
    text(r.lines[0], 254, 140, "left");
    label(data.organizer, 256, 192, "left", W - 256 - 72);
    nameBlock(70, 1160, "left", 96, 56, 1.02);
    label(`ATTENDEE · ${data.date}`, 74, 1380, "left", 884);
  } else {
    label(data.eventTitle, W / 2, 150, "center", 884, 28);
    nameBlock(W / 2, 660, "center", 120, 64, 1.08);
    ctx.font = mono(26);
    text(track("ATTENDEE"), 74, 1300, "left");
    text(track(`#${data.attendeeId}`), 74, 1346, "left");
    const modules = assets.qr ?? qrModules(data.badgeUrl);
    const n = modules.length;
    const s = Math.max(1, Math.floor(225 / n));
    const x0 = W - 74 - n * s;
    const y0 = 1380 - n * s;
    modules.forEach((row, y) =>
      row.forEach((on, x) => {
        if (on) ctx.fillRect(x0 + x * s, y0 + y * s, s, s);
      }),
    );
  }
  ctx.textAlign = "left";
}
