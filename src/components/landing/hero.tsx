import { Link } from "@tanstack/react-router";
import type { RefObject } from "react";

import type { HoloBadgeHandle } from "@/components/badge/holo-badge";
import type { BadgeControl } from "@/lib/badge/pose";

import { demoCard, LandingBadge } from "./landing-badge";
import type { GlowZone } from "./use-pointer-glow";

const alex = demoCard("Alex", "Rivera");

export function Hero({
  control,
  fx,
  onBadgeBackend,
}: {
  control: RefObject<BadgeControl>;
  fx: GlowZone;
  onBadgeBackend: (backend: HoloBadgeHandle["backend"]) => void;
}) {
  const { zone: zoneRef, etch: etchRef, glow: glowRef, foil: foilRef } = fx;
  return (
    <section className="hero js-hero" id="top" ref={zoneRef}>
      <header className="wrap nav js-hero-nav">
        <a className="brand" href="#top">
          certi.
        </a>
        <nav className="nav-links" aria-label="Sections">
          <a href="#badge">The badge</a>
          <a href="#templates">Designs</a>
          <a href="#delivery">How it works</a>
          <a href="#exports">Sharing</a>
          <a href="#open">Open source</a>
        </nav>
        <div className="nav-actions">
          <Link to="/login" className="holo-btn holo-btn-ghost holo-btn-md">
            Sign in
          </Link>
          <Link to="/dashboard/new" className="holo-btn holo-btn-solid holo-btn-md">
            Create an event
          </Link>
        </div>
      </header>
      <div className="wrap hero-grid">
        <div className="hero-copy js-hero-copy">
          <div className="js-hero-fade">
            <span className="holo-tag holo-tag-foil">Free and open source</span>
          </div>
          <h1 className="display">
            <span className="line">
              <span className="js-hero-line">Event badges</span>
            </span>
            <span className="line">
              <span className="js-hero-line">
                that{" "}
                <span className="it foil" ref={foilRef}>
                  catch the light.
                </span>
              </span>
            </span>
          </h1>
          <p className="lede js-hero-fade">
            Upload your guest list, pick a design, and Certi emails every guest a holographic badge
            of their own. It shimmers as it moves, and it’s theirs to keep and share.
          </p>
          <div className="actions js-hero-fade">
            <Link to="/dashboard/new" className="holo-btn holo-btn-solid holo-btn-md">
              Create an event
            </Link>
            <a className="holo-btn holo-btn-ghost holo-btn-md" href="#delivery">
              See how it works
            </a>
          </div>
          <p className="hero-note js-hero-fade">Sign in with Google or GitHub to get started.</p>
        </div>
        <div className="hero-stage js-hero-stage">
          <div className="etch js-hero-etch" ref={etchRef} aria-hidden="true">
            <div className="etch-lines" />
            <div className="etch-light">
              <div className="etch-glow" ref={glowRef} />
            </div>
          </div>
          <LandingBadge
            className="hero-badge js-hero-slot"
            data={alex}
            control={control}
            onBackendChange={onBadgeBackend}
          />
          <p className="holo-hint">Point at it to see it shine</p>
        </div>
      </div>
    </section>
  );
}
