import { type RefObject, useEffect, useState } from "react";

import { type BadgeControl, createBadgeControl, type Pose } from "@/lib/badge/pose";

type Gsap = (typeof import("gsap"))["gsap"];
type Motion = { gsap: Gsap; ctx: gsap.Context };

export type LandingControls = {
  hero: RefObject<BadgeControl>;
  show: RefObject<BadgeControl>;
  mail: RefObject<BadgeControl>;
};

/**
 * Scroll-driven motion for the landing page. GSAP is loaded only here, on the client, and not at
 * all under reduced motion, where the page stays a static read. `heroLive` turns true once the hero
 * badge is drawing with WebGPU, which starts its intro.
 */
export function useLandingMotion(
  rootRef: RefObject<HTMLElement | null>,
  { hero, show, mail }: LandingControls,
  heroLive: boolean,
) {
  const [motion, setMotion] = useState<Motion | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // The control objects never change identity; the page only mutates them.
    const controls = { hero: hero.current, show: show.current, mail: mail.current };
    let cancelled = false;
    let teardown: (() => void) | undefined;

    (async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      root.classList.add("is-motion");

      // ScrollTriggers are created in page order so each pin's spacing is measured before the ones below it.
      const ctx = gsap.context(() => {
        introText(gsap);
        heroScroll(gsap, controls.hero);
        manifesto(gsap);
      }, root);
      const mm = gsap.matchMedia(root);
      mm.add("(min-width: 960px)", () => {
        showcase(gsap, root, controls.show);
        templatesTrack(gsap, root);
        return () => {
          controls.show.driver = null;
        };
      });
      ctx.add(() => {
        delivery(gsap, controls.mail);
        exportsMotion(gsap);
        reveals(gsap, root);
      });
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
      // Late web fonts change line heights, and so every trigger's position.
      void document.fonts?.ready.then(() => {
        if (!cancelled) ScrollTrigger.refresh();
      });
      setMotion({ gsap, ctx });

      teardown = () => {
        mm.revert();
        ctx.revert();
        root.classList.remove("is-motion");
        const rest = createBadgeControl();
        for (const c of Object.values(controls)) Object.assign(c.offset, rest.offset);
        // Only the driver the motion set; the mail badge's still driver belongs to the page.
        controls.show.driver = null;
        setMotion(null);
      };
    })();

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [rootRef, hero, show, mail]);

  useEffect(() => {
    if (motion && heroLive) motion.ctx.add(() => introBadge(motion.gsap, hero.current));
  }, [motion, heroLive, hero]);
}

// The timelines below are the design's, unchanged apart from badge controls standing in for its stages.

function introText(gsap: Gsap) {
  gsap
    .timeline({ defaults: { ease: "power4.out" } })
    .from(".js-hero-line", { yPercent: 115, duration: 1.2, stagger: 0.1 })
    .from(".js-hero-fade", { y: 18, opacity: 0, duration: 0.9, stagger: 0.08 }, 0.45)
    .from(".js-hero-nav", { opacity: 0, duration: 0.8, ease: "none" }, 0.2)
    .from(".js-hero-etch", { opacity: 0, duration: 1.8, ease: "sine.out" }, 0.5);
}

// The card swings in edge-first, then the light comes up on it.
function introBadge(gsap: Gsap, st: BadgeControl) {
  gsap.set(st.offset, { tiltX: 1.2, hover: 0 });
  gsap
    .timeline()
    .from(".js-hero-slot", { opacity: 0, duration: 0.5, ease: "none" }, 0)
    .to(st.offset, { tiltX: 0, duration: 2.2, ease: "expo.out" }, 0)
    .to(st.offset, { hover: 1, duration: 1.6, ease: "sine.inOut" }, 0.4);
}

function heroScroll(gsap: Gsap, st: BadgeControl) {
  const trig = () => ({ trigger: ".js-hero", start: "top top", end: "bottom top", scrub: true });
  gsap.to(".js-hero-stage", { yPercent: 14, scale: 0.92, ease: "none", scrollTrigger: trig() });
  gsap.to(".js-hero-copy", { yPercent: -10, opacity: 0.25, ease: "none", scrollTrigger: trig() });
  gsap.to(st.offset, { tiltY: -0.3, ease: "none", scrollTrigger: trig() });
}

function manifesto(gsap: Gsap) {
  gsap.fromTo(
    ".js-word",
    { opacity: 0.14 },
    {
      opacity: 1,
      ease: "none",
      stagger: 0.12,
      scrollTrigger: { trigger: ".js-manifesto", start: "top 78%", end: "bottom 50%", scrub: true },
    },
  );
}

// Pinned: scroll drives the shader's light directly, one step per caption.
function showcase(gsap: Gsap, root: HTMLElement, st: BadgeControl) {
  const p = { x: -1.5, y: -1.15, h: 0, tx: 0, ty: 0 };
  st.driver = (): Pose => ({ tilt: [p.tx, p.ty], pointer: [p.x, p.y], hover: p.h });
  const steps = gsap.utils.toArray<HTMLElement>(".js-step", root);
  gsap.set(steps.slice(1), { autoAlpha: 0, y: 32 });
  const tl = gsap.timeline({
    defaults: { ease: "sine.inOut" },
    scrollTrigger: {
      trigger: ".js-show",
      start: "top top",
      end: "+=360%",
      pin: true,
      scrub: 0.8,
      anticipatePin: 1,
    },
  });
  const swap = (from: number, to: number, at: number) => {
    tl.to(steps[from], { autoAlpha: 0, y: -32, duration: 0.25, ease: "power2.in" }, at - 0.25).to(
      steps[to],
      { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out" },
      at,
    );
  };
  tl.fromTo(".js-rail-fill", { scaleY: 0 }, { scaleY: 1, duration: 4, ease: "none" }, 0)
    .to(p, { x: -1.05, y: -0.85, duration: 0.9 }, 0)
    .to(p, { h: 1, x: 0.35, y: -0.3, tx: 0.05, ty: -0.03, duration: 1 }, 1)
    .to(p, { tx: -0.17, ty: 0.12, x: -0.5, y: 0.2, duration: 0.5 }, 2)
    .to(p, { tx: 0.17, ty: -0.11, x: 0.6, y: -0.45, duration: 0.5 }, 2.5)
    .to(p, { tx: 0.04, ty: -0.03, x: -0.3, y: 0.62, h: 0.92, duration: 1 }, 3);
  swap(0, 1, 1);
  swap(1, 2, 2);
  swap(2, 3, 3);
}

function templatesTrack(gsap: Gsap, root: HTMLElement) {
  const track = root.querySelector<HTMLElement>(".js-tpl-track");
  if (!track) return;
  const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
  gsap.to(track, {
    x: () => -dist(),
    ease: "none",
    scrollTrigger: {
      trigger: ".js-tpl",
      start: "top top",
      end: () => `+=${dist()}`,
      pin: true,
      scrub: 0.6,
      invalidateOnRefresh: true,
      anticipatePin: 1,
    },
  });
}

function delivery(gsap: Gsap, st: BadgeControl) {
  gsap.from(".js-flow-step", {
    opacity: 0,
    y: 36,
    duration: 0.9,
    stagger: 0.14,
    ease: "power3.out",
    scrollTrigger: { trigger: ".js-flow-steps", start: "top 78%" },
  });
  gsap.fromTo(
    ".js-mail",
    { y: 140, rotation: -3 },
    {
      y: 0,
      rotation: 0,
      ease: "none",
      scrollTrigger: {
        trigger: ".js-flow",
        start: "top bottom",
        end: "center center",
        scrub: true,
      },
    },
  );
  // The email picture develops as it scrolls into view, the way the light finds the card.
  gsap.set(st.offset, { hover: 0 });
  gsap.to(st.offset, {
    hover: 1,
    ease: "none",
    scrollTrigger: { trigger: ".js-mail", start: "top 70%", end: "bottom 70%", scrub: true },
  });
}

function exportsMotion(gsap: Gsap) {
  gsap.fromTo(
    ".js-strip",
    { xPercent: 4 },
    {
      xPercent: -10,
      ease: "none",
      scrollTrigger: {
        trigger: ".js-strip-viewport",
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
    },
  );
  gsap.from(".js-format", {
    opacity: 0,
    y: 24,
    duration: 0.7,
    stagger: 0.1,
    ease: "power3.out",
    scrollTrigger: { trigger: ".js-formats", start: "top 80%" },
  });
  gsap.from(".js-frame", {
    opacity: 0,
    y: 40,
    duration: 0.8,
    stagger: 0.08,
    ease: "power3.out",
    scrollTrigger: { trigger: ".js-strip-viewport", start: "top 85%" },
  });
}

function reveals(gsap: Gsap, root: HTMLElement) {
  gsap.utils.toArray<HTMLElement>(".js-reveal", root).forEach((el) => {
    gsap.from(el, {
      opacity: 0,
      y: 40,
      duration: 0.9,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 86%" },
    });
  });
}
