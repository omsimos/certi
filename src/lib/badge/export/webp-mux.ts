// Browsers can encode single WebP stills but not animations, so we stitch the
// stills into an animated container by hand (RIFF/VP8X/ANIM/ANMF).

type MuxOptions = { width: number; height: number; frameMs: number; loop?: number };

const FOURCC_FRAME_DATA = new Set(["VP8 ", "VP8L", "ALPH"]);

const fourcc = (s: string) => [...s].map((c) => c.charCodeAt(0));
const u16 = (n: number) => [n & 255, (n >> 8) & 255];
const u24 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];
const u32 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];

function chunk(id: string, payload: ArrayLike<number>): Uint8Array {
  const pad = payload.length & 1;
  const out = new Uint8Array(8 + payload.length + pad);
  out.set(fourcc(id), 0);
  out.set(u32(payload.length), 4);
  out.set(payload as ArrayLike<number>, 8);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

// Pulls the image chunks out of a complete WebP file. A still's own VP8X (if any)
// is dropped: only the outer container's canvas info applies.
function imageChunks(webp: Uint8Array): Uint8Array {
  const dv = new DataView(webp.buffer, webp.byteOffset, webp.byteLength);
  const kept: Uint8Array[] = [];
  for (let p = 12; p + 8 <= webp.length;) {
    const id = String.fromCharCode(...webp.subarray(p, p + 4));
    const size = dv.getUint32(p + 4, true);
    const end = p + 8 + size + (size & 1);
    if (FOURCC_FRAME_DATA.has(id)) kept.push(webp.subarray(p, end));
    p = end;
  }
  return concat(kept);
}

export function muxAnimatedWebp(frames: Uint8Array[], o: MuxOptions): Uint8Array {
  const { width, height, frameMs, loop = 0 } = o;
  const vp8x = chunk("VP8X", [0x02, 0, 0, 0, ...u24(width - 1), ...u24(height - 1)]);
  const anim = chunk("ANIM", [0, 0, 0, 0, ...u16(loop)]);
  const anmf = frames.map((f) =>
    chunk(
      "ANMF",
      concat([
        // x, y, width, height, duration, flags (dispose none, blend over)
        new Uint8Array([
          ...u24(0),
          ...u24(0),
          ...u24(width - 1),
          ...u24(height - 1),
          ...u24(frameMs),
          0,
        ]),
        imageChunks(f),
      ]),
    ),
  );
  const body = concat([new Uint8Array(fourcc("WEBP")), vp8x, anim, ...anmf]);
  return concat([new Uint8Array([...fourcc("RIFF"), ...u32(body.length)]), body]);
}
