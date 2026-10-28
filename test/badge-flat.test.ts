import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { drawFlatBadge } from "../src/lib/badge/flat";
import { cardRect } from "../src/lib/badge/layout";

type Call = { op: string; args: unknown[]; fillStyle?: unknown; strokeStyle?: unknown };

// Records every method call along with the paint state at call time.
function recordingCtx() {
  const calls: Call[] = [];
  const state: Record<string, unknown> = {
    fillStyle: "#000",
    strokeStyle: "#000",
    lineWidth: 1,
    globalCompositeOperation: "source-over",
    globalAlpha: 1,
  };
  const ctx = new Proxy(state, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return (...args: unknown[]) => {
        calls.push({
          op: prop,
          args,
          fillStyle: target.fillStyle,
          strokeStyle: target.strokeStyle,
        });
      };
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as OffscreenCanvasRenderingContext2D, calls };
}

// workerd has no OffscreenCanvas; the tint layer only needs a recording 2D context.
class FakeOffscreenCanvas {
  readonly ctx = recordingCtx();
  constructor(
    public width: number,
    public height: number,
  ) {}
  getContext() {
    return this.ctx.ctx;
  }
}

const lettering = { width: 1024, height: 1456 } as unknown as CanvasImageSource;
const W = 1080;
const H = 1536;

function draw(template: "graphite" | "branded" | "id", accent = "#6d3cff") {
  const { ctx, calls } = recordingCtx();
  drawFlatBadge(ctx, W, H, template, accent, lettering);
  return calls;
}

// The card is the first rounded rect that gets filled.
function cardFill(calls: Call[]) {
  const i = calls.findIndex((c) => c.op === "roundRect");
  const fill = calls.slice(i).find((c) => c.op === "fill");
  return fill?.fillStyle;
}

const strokes = (calls: Call[]) => calls.filter((c) => c.op === "stroke");

beforeEach(() => {
  vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("drawFlatBadge", () => {
  it("draws the triangle outline for graphite and branded", () => {
    for (const t of ["graphite", "branded"] as const) {
      const s = strokes(draw(t));
      expect(s).toHaveLength(1);
      expect(s[0].strokeStyle).toBe("#4a5260");
    }
  });

  it("draws no triangle path for id", () => {
    const calls = draw("id");
    expect(strokes(calls)).toHaveLength(0);
    expect(calls.some((c) => c.op === "closePath")).toBe(false);
  });

  it("tints the branded card fill with the accent", () => {
    // accent × 0.34, as in the shader's mix toward params.accent.rgb * 0.34.
    expect(cardFill(draw("branded", "#6d3cff"))).toBe("rgb(37, 20, 87)");
    expect(cardFill(draw("branded", "#ff0000"))).toBe("rgb(87, 0, 0)");
  });

  it("keeps the graphite card fill independent of the accent", () => {
    expect(cardFill(draw("graphite", "#6d3cff"))).toBe(cardFill(draw("graphite", "#ff0000")));
    expect(cardFill(draw("graphite"))).not.toBe(cardFill(draw("branded")));
  });

  it("draws the lettering into the card rect", () => {
    const r = cardRect(W, H);
    for (const t of ["graphite", "branded", "id"] as const) {
      const images = draw(t).filter((c) => c.op === "drawImage");
      expect(images).toHaveLength(1);
      expect(images[0].args.slice(1)).toEqual([r.x, r.y, r.w, r.h]);
    }
  });

  it("fills the background with #090a0c first", () => {
    const calls = draw("graphite");
    expect(calls[0]).toMatchObject({ op: "fillRect", args: [0, 0, W, H], fillStyle: "#090a0c" });
  });
});

describe("drawFlatBadge without OffscreenCanvas", () => {
  it("tints the lettering on a DOM canvas instead", () => {
    // Safari before 16.4: no OffscreenCanvas, only <canvas>.
    vi.stubGlobal("OffscreenCanvas", undefined);
    const created: FakeOffscreenCanvas[] = [];
    vi.stubGlobal("document", {
      createElement(tag: string) {
        expect(tag).toBe("canvas");
        const c = new FakeOffscreenCanvas(0, 0);
        created.push(c);
        return c;
      },
    });

    const r = cardRect(W, H);
    const calls = draw("graphite");

    expect(created).toHaveLength(1);
    expect([created[0].width, created[0].height]).toEqual([Math.ceil(r.w), Math.ceil(r.h)]);
    expect(created[0].ctx.calls.map((c) => c.op)).toEqual(["drawImage", "fillRect"]);
    const image = calls.find((c) => c.op === "drawImage");
    expect(image?.args[0]).toBe(created[0]);
  });
});
