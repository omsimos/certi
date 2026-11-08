import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import type { BadgeTemplate } from "@/lib/badge/templates";
import { cn } from "@/lib/utils";

import { demoCard, LandingBadge } from "./landing-badge";
import type { GlowZone } from "./use-pointer-glow";

const PILLS: { id: BadgeTemplate; label: string }[] = [
  { id: "graphite", label: "Graphite" },
  { id: "branded", label: "Branded" },
  { id: "id", label: "ID" },
];

export function TryIt({ accent, fx }: { accent: string; fx: GlowZone }) {
  const [first, setFirst] = useState("Alex");
  const [last, setLast] = useState("Rivera");
  const [template, setTemplate] = useState<BadgeTemplate>("graphite");
  const [card, setCard] = useState(() => demoCard("Alex", "Rivera", "0001"));

  // Each new name re-letters the badge, so wait for a pause in typing.
  useEffect(() => {
    const t = setTimeout(() => setCard(demoCard(first.trim(), last.trim(), "0001")), 120);
    return () => clearTimeout(t);
  }, [first, last]);

  const { zone: zoneRef, etch: etchRef, glow: glowRef, foil: foilRef } = fx;
  return (
    <section className="try" id="try" ref={zoneRef}>
      <div className="wrap try-grid">
        <div className="try-copy js-reveal">
          <div className="head">
            <p className="kicker">Try it</p>
            <h2 className="h2">
              Put{" "}
              <span className="it foil" ref={foilRef}>
                your name
              </span>{" "}
              on it.
            </h2>
          </div>
          <p className="body">
            Type a name and pick a design. This is the same badge your guests will get.
          </p>
          <div className="try-fields">
            <label className="holo-field">
              <span className="holo-field-label">First name</span>
              <input
                className="holo-input"
                id="try-first"
                value={first}
                maxLength={40}
                autoComplete="given-name"
                onChange={(e) => setFirst(e.target.value)}
              />
            </label>
            <label className="holo-field">
              <span className="holo-field-label">Last name</span>
              <input
                className="holo-input"
                id="try-last"
                value={last}
                maxLength={40}
                autoComplete="family-name"
                onChange={(e) => setLast(e.target.value)}
              />
            </label>
          </div>
          <div className="pills" role="group" aria-label="Design">
            {PILLS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={cn("pill", p.id === template && "is-on")}
                aria-pressed={p.id === template}
                onClick={() => setTemplate(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="actions">
            <Link to="/dashboard/new" className="holo-btn holo-btn-solid holo-btn-md">
              Create an event
            </Link>
            <a
              className="holo-btn holo-btn-ghost holo-btn-md"
              href="https://github.com/omsimos/certi"
            >
              Read the code
            </a>
          </div>
        </div>
        <div className="try-stage">
          <div className="etch etch-try" ref={etchRef} aria-hidden="true">
            <div className="etch-lines" />
            <div className="etch-light">
              <div className="etch-glow" ref={glowRef} />
            </div>
          </div>
          <LandingBadge className="try-badge" template={template} accent={accent} data={card} />
          <p className="holo-hint">Point at it to see it shine</p>
        </div>
      </div>
    </section>
  );
}
