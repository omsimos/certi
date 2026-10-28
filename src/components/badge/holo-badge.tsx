import {
  type PointerEvent as ReactPointerEvent,
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import { drawFlatBadge } from "@/lib/badge/flat";
import {
  type BadgeCardData,
  cardRect,
  drawLettering,
  LETTERING_SIZE,
  maskFromImageData,
} from "@/lib/badge/layout";
import { type Pose, pointerToCard, poseFromPointer, STILL_POSE, sweepPose } from "@/lib/badge/pose";
import { type BadgeTemplate, TEMPLATE_MODE } from "@/lib/badge/templates";
import { cn } from "@/lib/utils";

import {
  createHoloRenderer,
  type HoloRenderer,
  type HoloScene,
  WebGPUUnavailableError,
} from "./holo-renderer";

export type HoloBadgeHandle = {
  backend: "webgpu" | "flat";
  renderStill(o: {
    width: number;
    height: number;
    type: "image/png" | "image/jpeg";
    quality?: number;
    pose?: Pose;
  }): Promise<Blob>;
  renderFrames(o: {
    width: number;
    height: number;
    times: number[];
    onFrame: (canvas: OffscreenCanvas, i: number) => Promise<void>;
    signal?: AbortSignal;
  }): Promise<void>;
};

export type HoloBadgeProps = {
  template: BadgeTemplate;
  accent: string;
  data: BadgeCardData;
  logoUrl?: string | null;
  interactive?: boolean;
  className?: string;
  ref?: Ref<HoloBadgeHandle>;
};

type Backend = HoloBadgeHandle["backend"];
type Lettering = { template: BadgeTemplate; canvas: OffscreenCanvas; mask: Uint8Array };

const IDLE_MS = 2500;
// One idle sweep per export loop, so the live card previews the animated export.
const SWEEP_SECONDS = 4;
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

const dpr = () => Math.min(Math.max(devicePixelRatio, 1), 2);

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

async function buildLettering(
  template: BadgeTemplate,
  data: BadgeCardData,
  logoUrl: string | null,
): Promise<Lettering> {
  const [, logo] = await Promise.all([
    loadFonts(),
    template === "branded" && logoUrl ? loadLogo(logoUrl) : null,
  ]);
  const [W, H] = LETTERING_SIZE;
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't get a 2D canvas context");
  drawLettering(ctx, template, data, { logo });
  logo?.close();
  return { template, canvas, mask: maskFromImageData(ctx.getImageData(0, 0, W, H)) };
}

function initialBackend(): Backend {
  // Dev-only switch for checking the fallback in a WebGPU browser.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("flat")) return "flat";
  return "webgpu";
}

// Draws onto a 2D OffscreenCanvas, so consumers can read pixels or await between frames.
async function exportPainter(
  backend: Backend,
  lettering: Lettering,
  accent: string,
  width: number,
  height: number,
) {
  const out = new OffscreenCanvas(width, height);
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Couldn't get a 2D canvas context");
  if (backend === "flat") {
    drawFlatBadge(ctx, width, height, lettering.template, accent, lettering.canvas);
    return { out, paint: (_pose: Pose) => {}, dispose: () => {} };
  }
  const gpuCanvas = new OffscreenCanvas(width, height);
  const renderer = await createHoloRenderer(gpuCanvas);
  renderer.setScene({ template: lettering.template, accent, mask: lettering.mask });
  return {
    out,
    paint: (pose: Pose) => {
      renderer.draw(pose);
      ctx.drawImage(gpuCanvas, 0, 0);
    },
    dispose: () => renderer.dispose(),
  };
}

export function HoloBadge({
  template,
  accent,
  data,
  logoUrl = null,
  interactive = true,
  className,
  ref,
}: HoloBadgeProps) {
  const [backend, setBackend] = useState<Backend>(initialBackend);
  const [lettering, setLettering] = useState<Lettering | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const sheenRef = useRef<HTMLDivElement>(null);
  const props = useRef({ template, accent, data, logoUrl, interactive });
  const letteringPromise = useRef<Promise<Lettering> | null>(null);
  const scene = useRef<HoloScene | null>(null);
  // Pointer and smoothed pose, mutated per frame without re-rendering.
  const motion = useRef({
    px: 0,
    py: 0,
    targetHover: 0,
    tx: 0,
    ty: 0,
    hover: 0,
    lx: 0.2,
    ly: -0.25,
    // No input yet, so the idle sweep plays from mount and keeps phones alive before a touch.
    last: -Infinity,
  });

  useEffect(() => {
    props.current = { template, accent, data, logoUrl, interactive };
  });

  // Compared by value: callers often pass a fresh `data` object each render.
  const letteringKey = JSON.stringify([template, data, logoUrl]);
  useEffect(() => {
    const { template, data, logoUrl } = props.current;
    let cancelled = false;
    const p = buildLettering(template, data, logoUrl);
    letteringPromise.current = p;
    p.then(
      (l) => !cancelled && setLettering(l),
      (err) => console.error(err),
    );
    return () => {
      cancelled = true;
    };
  }, [letteringKey]);

  useEffect(() => {
    scene.current = lettering
      ? { template: lettering.template, accent, mask: lettering.mask }
      : null;
  }, [lettering, accent]);

  useEffect(() => {
    if (backend !== "webgpu") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduce = matchMedia(REDUCED_MOTION);
    let renderer: HoloRenderer | null = null;
    let applied: HoloScene | null = null;
    let raf = 0;
    let stopped = false;
    let prev = performance.now();

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - prev) / 1000, 0.1);
      prev = now;
      const current = scene.current;
      if (!renderer || !current) return;
      if (current !== applied) {
        renderer.setScene(current);
        applied = current;
      }

      const w = Math.round(canvas.clientWidth * dpr());
      const h = Math.round(canvas.clientHeight * dpr());
      if (!w || !h) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const m = motion.current;
      const reduced = reduce.matches;
      const { interactive, template } = props.current;
      const blend = reduced ? 1 : 1 - Math.exp(-10 * dt);
      if (!reduced && (!interactive || now - m.last > IDLE_MS)) {
        // Offset per template so side-by-side previews don't sweep in lockstep.
        const sweep = sweepPose(now / 1000 / SWEEP_SECONDS + TEMPLATE_MODE[template] * 0.3);
        [m.px, m.py] = sweep.pointer;
        m.targetHover = sweep.hover;
      } else if (reduced && !interactive) {
        [m.px, m.py] = STILL_POSE.pointer;
        m.targetHover = STILL_POSE.hover;
      }
      const [tx, ty] = reduced ? [0, 0] : poseFromPointer(m.px, m.py, m.targetHover).tilt;
      m.tx += (tx - m.tx) * blend;
      m.ty += (ty - m.ty) * blend;
      m.hover += (m.targetHover - m.hover) * blend;
      if (m.targetHover > 0) {
        m.lx += (m.px - m.lx) * blend;
        m.ly += (m.py - m.ly) * blend;
      }
      renderer.draw({ tilt: [m.tx, m.ty], pointer: [m.lx, m.ly], hover: m.hover });
    };

    createHoloRenderer(canvas).then(
      (r) => {
        if (stopped) return r.dispose();
        renderer = r;
        r.lost.then(() => !stopped && setBackend("flat"));
        raf = requestAnimationFrame(frame);
      },
      (err) => {
        if (stopped) return;
        if (!(err instanceof WebGPUUnavailableError)) console.error(err);
        setBackend("flat");
      },
    );
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      renderer?.dispose();
    };
  }, [backend]);

  useEffect(() => {
    if (backend !== "flat" || !lettering) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const paint = () => {
      const w = Math.round(canvas.clientWidth * dpr());
      const h = Math.round(canvas.clientHeight * dpr());
      if (!w || !h) return;
      canvas.width = w;
      canvas.height = h;
      drawFlatBadge(ctx, w, h, lettering.template, accent, lettering.canvas);
    };
    // Also fires once on observe, which does the first paint.
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [backend, lettering, accent]);

  useImperativeHandle(ref, () => {
    // What the viewer sees right now, so a still export matches the live card.
    const livePose = (): Pose => {
      if (backend === "flat" || !props.current.interactive) return STILL_POSE;
      const m = motion.current;
      return { tilt: [m.tx, m.ty], pointer: [m.lx, m.ly], hover: m.hover };
    };
    return {
      backend,
      async renderStill({ width, height, type, quality, pose }) {
        const still = pose ?? livePose();
        const l = await letteringPromise.current;
        if (!l) throw new Error("The badge isn't ready yet");
        const painter = await exportPainter(backend, l, props.current.accent, width, height);
        try {
          painter.paint(still);
          return await painter.out.convertToBlob({ type, quality });
        } finally {
          painter.dispose();
        }
      },
      async renderFrames({ width, height, times, onFrame, signal }) {
        const l = await letteringPromise.current;
        if (!l) throw new Error("The badge isn't ready yet");
        const painter = await exportPainter(backend, l, props.current.accent, width, height);
        try {
          for (let i = 0; i < times.length; i++) {
            signal?.throwIfAborted();
            painter.paint(sweepPose(times[i]));
            await onFrame(painter.out, i);
          }
        } finally {
          painter.dispose();
        }
      },
    };
  }, [backend]);

  const flat = backend === "flat";

  const onPointer = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!interactive || !e.isPrimary) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const p = pointerToCard(e.clientX, e.clientY, rect);
    const m = motion.current;
    m.px = p.x;
    m.py = p.y;
    m.targetHover = p.hover;
    m.last = performance.now();
    if (!flat) return;

    const tiltEl = tiltRef.current;
    const sheen = sheenRef.current;
    if (!tiltEl || !sheen) return;
    const [rx, ry] = matchMedia(REDUCED_MOTION).matches
      ? [0, 0]
      : poseFromPointer(p.x, p.y, p.hover).tilt;
    // Same rotation axes as the shader: tilt.x turns about the vertical axis.
    tiltEl.style.transform = `perspective(1200px) rotateX(${ry}rad) rotateY(${rx}rad)`;
    const card = cardRect(rect.width, rect.height);
    Object.assign(sheen.style, {
      left: `${card.x}px`,
      top: `${card.y}px`,
      width: `${card.w}px`,
      height: `${card.h}px`,
      borderRadius: `${card.w * (0.055 / 1.28)}px`,
      opacity: String(p.hover),
      background: `radial-gradient(circle at ${e.clientX - rect.left - card.x}px ${e.clientY - rect.top - card.y}px, rgb(255 255 255 / 0.16), transparent 55%)`,
    });
  };

  const onPointerLeave = () => {
    const m = motion.current;
    m.targetHover = 0;
    m.last = performance.now();
    if (tiltRef.current) tiltRef.current.style.transform = "";
    if (sheenRef.current) sheenRef.current.style.opacity = "0";
  };

  return (
    <div className={cn("relative", className)}>
      <div ref={tiltRef} className="relative transition-transform duration-200 ease-out">
        <canvas
          key={backend}
          ref={canvasRef}
          data-backend={backend}
          role="img"
          aria-label={`${data.firstName} ${data.lastName}, ${data.eventTitle} badge`}
          className={cn(
            "block aspect-[300/430] w-full rounded-xl bg-[#090a0c]",
            interactive && "touch-none",
          )}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={interactive ? onPointerLeave : undefined}
        />
        {flat && interactive && (
          <div
            ref={sheenRef}
            aria-hidden
            className="pointer-events-none absolute opacity-0 mix-blend-screen transition-opacity duration-200"
          />
        )}
      </div>
      {flat && interactive && (
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Your browser doesn&apos;t support WebGPU, so you&apos;re seeing the flat badge.
        </p>
      )}
    </div>
  );
}
