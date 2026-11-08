import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { Delivery } from "@/components/landing/delivery";
import { Exports } from "@/components/landing/exports";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { Manifesto } from "@/components/landing/manifesto";
import { OpenSource } from "@/components/landing/open-source";
import { Showcase } from "@/components/landing/showcase";
import { Templates } from "@/components/landing/templates";
import { TryIt } from "@/components/landing/try-it";
import { useGlowZone, usePointerGlow } from "@/components/landing/use-pointer-glow";
import { type BadgeControl, createBadgeControl, STILL_POSE } from "@/lib/badge/pose";
import { DEFAULT_ACCENT } from "@/lib/badge/templates";
import landingCss from "@/styles/landing.css?url";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Certi — event badges that catch the light" }],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap",
      },
      { rel: "stylesheet", href: landingCss },
    ],
  }),
  staticData: { hideNavbar: true },
  component: Landing,
});

function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const heroControl = useRef(createBadgeControl());
  const showControl = useRef(createBadgeControl());
  // The email picture is a still, so it holds one pose instead of sweeping.
  const mailControl = useRef<BadgeControl>({ ...createBadgeControl(), driver: () => STILL_POSE });
  const heroFx = useGlowZone();
  const tryFx = useGlowZone();
  usePointerGlow([heroFx, tryFx]);
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [, setHeroBackend] = useState<"webgpu" | "flat" | null>(null);

  return (
    // `dark` keeps the badge's own fallback text readable whatever the app theme is.
    <div ref={root} className="landing dark">
      <div className="grain" aria-hidden="true" />
      <Hero control={heroControl} fx={heroFx} onBadgeBackend={setHeroBackend} />
      <Manifesto />
      <Showcase control={showControl} />
      <Templates accent={accent} onAccent={setAccent} />
      <Delivery mailControl={mailControl} />
      <Exports />
      <OpenSource />
      <TryIt accent={accent} fx={tryFx} />
      <Footer />
    </div>
  );
}
