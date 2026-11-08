import { type RefObject, useEffect, useRef } from "react";

// The elements one pointer-glow zone drives: the section, its etched background, the glow
// inside it, and the italic headline words that catch the same light.
export type GlowZone = {
  zone: RefObject<HTMLElement | null>;
  etch: RefObject<HTMLDivElement | null>;
  glow: RefObject<HTMLDivElement | null>;
  foil: RefObject<HTMLSpanElement | null>;
};

export function useGlowZone(): GlowZone {
  return {
    zone: useRef<HTMLElement>(null),
    etch: useRef<HTMLDivElement>(null),
    glow: useRef<HTMLDivElement>(null),
    foil: useRef<HTMLSpanElement>(null),
  };
}

/**
 * A soft pearl glow follows the pointer across each zone's etched background and italic headline
 * words, the way light finds the foil on a badge. With no pointer in the zone it drifts slowly
 * around the badge. Draws only while something is moving.
 */
export function usePointerGlow(zones: GlowZone[]) {
  const latest = useRef(zones);
  useEffect(() => {
    latest.current = zones;
  });

  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const light = { x: -1e4, y: -1e4, active: false, last: 0 };
    const smoothed = new WeakMap<GlowZone, { x: number; y: number; i: number }>();
    let raf = 0;

    const frame = (now: number) => {
      raf = 0;
      const still = reduce.matches;
      const dt = light.last ? Math.min((now - light.last) / 1000, 0.1) : 1 / 60;
      light.last = now;
      const blend = still ? 1 : 1 - Math.exp(-8 * dt);
      const vh = window.innerHeight || 900;
      let again = false;
      for (const fx of latest.current) {
        const etch = fx.etch.current;
        const glow = fx.glow.current;
        const zone = fx.zone.current;
        if (!etch || !glow || !zone) continue;
        const zr = zone.getBoundingClientRect();
        if (zr.bottom < 0 || zr.top > vh) continue;
        const r = etch.getBoundingClientRect();
        const w = etch.offsetWidth;
        const h = etch.offsetHeight;
        if (!r.width || !r.height || !w || !h) continue;
        // Etch-local px, undoing any scale GSAP puts on the stage.
        const kx = w / r.width;
        const ky = h / r.height;
        let z = smoothed.get(fx);
        if (!z) {
          z = { x: w / 2, y: h / 2, i: 0 };
          smoothed.set(fx, z);
        }
        const inside =
          light.active &&
          light.x >= zr.left &&
          light.x <= zr.right &&
          light.y >= zr.top &&
          light.y <= zr.bottom;
        let tx: number;
        let ty: number;
        let ti: number;
        if (inside) {
          tx = (light.x - r.left) * kx;
          ty = (light.y - r.top) * ky;
          ti = 0.5;
        } else {
          // A 16 s drift around the badge.
          const a = still ? 0.9 : (now / 1000) * ((Math.PI * 2) / 16);
          tx = w / 2 + Math.cos(a) * w * 0.15;
          ty = h / 2 + Math.sin(a * 2) * h * 0.13;
          ti = 0.16;
        }
        z.x += (tx - z.x) * blend;
        z.y += (ty - z.y) * blend;
        z.i += (ti - z.i) * blend;
        const R = glow.offsetWidth / 2;
        glow.style.transform = `translate3d(${(z.x - R).toFixed(1)}px, ${(z.y - R).toFixed(1)}px, 0)`;
        glow.style.backgroundPosition = `${(R - z.x).toFixed(1)}px ${(R - z.y).toFixed(1)}px`;
        glow.style.opacity = z.i.toFixed(3);
        const foil = fx.foil.current;
        if (foil) {
          const fr = foil.getBoundingClientRect();
          foil.style.setProperty("--gx", `${(r.left + z.x / kx - fr.left).toFixed(1)}px`);
          foil.style.setProperty("--gy", `${(r.top + z.y / ky - fr.top).toFixed(1)}px`);
          foil.style.setProperty("--gi", Math.min(1, z.i / 0.5).toFixed(3));
        }
        const settled =
          Math.abs(tx - z.x) < 0.5 && Math.abs(ty - z.y) < 0.5 && Math.abs(ti - z.i) < 0.002;
        if (!settled || (!still && !inside)) again = true;
      }
      if (again) kick();
    };

    const kick = () => {
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const onMove = (e: PointerEvent) => {
      if (e.isPrimary === false) return;
      light.x = e.clientX;
      light.y = e.clientY;
      light.active = true;
      kick();
    };
    const onOut = () => {
      light.active = false;
      kick();
    };
    // A touch lifts away, so the light goes back to drifting; a mouse stays where it is.
    const onUp = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") onOut();
    };
    const html = document.documentElement;

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("blur", onOut);
    window.addEventListener("scroll", kick, { passive: true });
    html.addEventListener("pointerleave", onOut, { passive: true });
    kick();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("blur", onOut);
      window.removeEventListener("scroll", kick);
      html.removeEventListener("pointerleave", onOut);
    };
  }, []);
}
