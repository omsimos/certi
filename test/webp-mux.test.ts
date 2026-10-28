import { describe, expect, it } from "vitest";
import { muxAnimatedWebp } from "../src/lib/badge/export/webp-mux";

const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];

// 5-byte payload is odd on purpose: the chunk needs a pad byte.
function frame(): Uint8Array {
  const chunk = [...ascii("VP8L"), ...u32(5), 1, 2, 3, 4, 5, 0];
  return new Uint8Array([...ascii("RIFF"), ...u32(4 + chunk.length), ...ascii("WEBP"), ...chunk]);
}

type Chunk = { id: string; start: number; size: number; data: Uint8Array };

function chunks(buf: Uint8Array, from: number, to: number): Chunk[] {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const out: Chunk[] = [];
  for (let p = from; p < to;) {
    const size = dv.getUint32(p + 4, true);
    out.push({
      id: String.fromCharCode(...buf.subarray(p, p + 4)),
      start: p,
      size,
      data: buf.subarray(p + 8, p + 8 + size),
    });
    p += 8 + size + (size & 1);
  }
  return out;
}

const u24 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);

describe("muxAnimatedWebp", () => {
  const out = muxAnimatedWebp([frame(), frame()], { width: 720, height: 1024, frameMs: 42 });
  const dv = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const top = chunks(out, 12, out.length);

  it("writes a RIFF WEBP header with a correct size", () => {
    expect(String.fromCharCode(...out.subarray(0, 4))).toBe("RIFF");
    expect(dv.getUint32(4, true)).toBe(out.length - 8);
    expect(String.fromCharCode(...out.subarray(8, 12))).toBe("WEBP");
  });

  it("declares animation and canvas size in VP8X", () => {
    const vp8x = top.find((c) => c.id === "VP8X")!;
    expect(vp8x.data[0] & 0x02).toBe(0x02);
    expect(u24(vp8x.data, 4) + 1).toBe(720);
    expect(u24(vp8x.data, 7) + 1).toBe(1024);
  });

  it("loops forever by default", () => {
    const anim = top.find((c) => c.id === "ANIM")!;
    expect(new DataView(anim.data.buffer, anim.data.byteOffset).getUint16(4, true)).toBe(0);
  });

  it("wraps each frame in an ANMF with the frame duration", () => {
    const anmf = top.filter((c) => c.id === "ANMF");
    expect(anmf).toHaveLength(2);
    for (const a of anmf) {
      expect(u24(a.data, 12)).toBe(42);
      const inner = chunks(a.data, 16, a.data.length);
      expect(inner.map((c) => c.id)).toEqual(["VP8L"]);
    }
  });

  it("starts every chunk on an even offset", () => {
    const all = [
      ...top,
      ...top
        .filter((c) => c.id === "ANMF")
        .flatMap((a) =>
          chunks(a.data, 16, a.data.length).map((c) => ({ ...c, start: c.start + a.start + 8 })),
        ),
    ];
    for (const c of all) expect(c.start % 2).toBe(0);
  });
});
