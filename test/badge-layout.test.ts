import { describe, expect, it } from "vitest";
import {
  type BadgeCardData,
  cardRect,
  CARD_HALF,
  drawLettering,
  fitText,
  LETTERING_SIZE,
  maskFromImageData,
} from "../src/lib/badge/layout";
import { qrModules } from "../src/lib/badge/qr";
import { BADGE_TEMPLATES } from "../src/lib/badge/templates";

const measure = (t: string, px: number) => t.length * px * 0.55;
const opts = { maxWidth: 884, maxPx: 96, minPx: 56, maxLines: 2 as const };

describe("fitText", () => {
  it("keeps a short name on one line at maxPx", () => {
    expect(fitText(measure, "Ana Cruz", opts)).toEqual({
      lines: ["Ana Cruz"],
      px: 96,
    });
  });

  it("wraps a long name to two lines that fit", () => {
    const r = fitText(measure, "Maria Clara Dela Cruz-Villanueva", opts);
    expect(r.lines).toHaveLength(2);
    for (const l of r.lines) expect(measure(l, r.px)).toBeLessThanOrEqual(884);
  });

  it("ellipsizes a 200-character name on the last line", () => {
    const r = fitText(measure, "abcd ".repeat(40).trim(), opts);
    expect(r.lines).toHaveLength(2);
    expect(r.lines[1].endsWith("…")).toBe(true);
    for (const l of r.lines) expect(measure(l, r.px)).toBeLessThanOrEqual(884);
  });

  it("does not split a name without spaces; shrinks then ellipsizes", () => {
    const r = fitText(measure, "王小明".repeat(14).slice(0, 40), opts);
    expect(r.lines).toHaveLength(1);
    expect(r.px).toBe(56);
    expect(r.lines[0].endsWith("…")).toBe(true);
    expect(measure(r.lines[0], r.px)).toBeLessThanOrEqual(884);
  });

  it("respects maxLines 1", () => {
    const r = fitText(measure, "Some Very Long Event Title ".repeat(6), {
      ...opts,
      maxLines: 1,
    });
    expect(r.lines).toHaveLength(1);
    expect(measure(r.lines[0], r.px)).toBeLessThanOrEqual(884);
  });
});

describe("cardRect", () => {
  it("matches the card aspect and is centered", () => {
    const r = cardRect(1080, 1536);
    expect(r.w / r.h).toBeCloseTo(CARD_HALF[0] / CARD_HALF[1], 2);
    expect(r.x + r.w / 2).toBeCloseTo(540, 5);
    expect(r.y + r.h / 2).toBeCloseTo(768, 5);
  });
});

describe("qrModules", () => {
  it("returns a square matrix of at least 21 modules", () => {
    const m = qrModules("https://x.test/a");
    expect(m.length).toBeGreaterThanOrEqual(21);
    for (const row of m) expect(row).toHaveLength(m.length);
  });
});

const data: BadgeCardData = {
  firstName: "Juan",
  lastName: "Dela Cruz",
  eventTitle: "DevFest Manila",
  organizer: "GDG Manila",
  date: "OCT 25 2026",
  attendeeId: "A1B2C3",
  badgeUrl: "https://x.test/b/abc",
};

function fakeCtx() {
  const texts: { text: string; x: number; y: number }[] = [];
  const ctx = {
    font: "",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    textAlign: "left",
    textBaseline: "alphabetic",
    measureText: (t: string) => ({
      width: measure(t, Number(/(\d+)px/.exec(ctx.font)?.[1] ?? 16)),
    }),
    fillText: (text: string, x: number, y: number) => texts.push({ text, x, y }),
    fillRect: () => {},
    beginPath: () => {},
    roundRect: () => {},
    stroke: () => {},
    drawImage: () => {},
    save: () => {},
    restore: () => {},
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, texts };
}

describe("drawLettering", () => {
  it.each(BADGE_TEMPLATES)("%s keeps text inside the canvas", (template) => {
    const { ctx, texts } = fakeCtx();
    drawLettering(ctx, template, data, {});
    expect(texts.length).toBeGreaterThan(0);
    for (const t of texts) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x).toBeLessThanOrEqual(LETTERING_SIZE[0]);
    }
    const all = texts.map((t) => t.text).join(" ");
    expect(all).toContain("Juan");
    expect(all).toContain("Dela Cruz");
  });

  it("draws the logo only on the branded template", () => {
    const logo = {} as CanvasImageSource;
    let drawn = 0;
    const { ctx } = fakeCtx();
    (ctx as unknown as { drawImage: () => void }).drawImage = () => drawn++;
    drawLettering(ctx, "branded", data, { logo });
    expect(drawn).toBe(1);
    drawLettering(ctx, "branded", data, {});
    expect(drawn).toBe(1);
  });
});

describe("maskFromImageData", () => {
  it("keeps the alpha channel only", () => {
    const px = { data: new Uint8ClampedArray([1, 2, 3, 4, 5, 6, 7, 8]) };
    expect([...maskFromImageData(px as ImageData)]).toEqual([4, 8]);
  });
});
