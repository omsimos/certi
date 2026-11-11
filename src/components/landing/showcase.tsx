import type { RefObject } from "react";

import type { BadgeControl } from "@/lib/badge/pose";

import { demoCard, LandingBadge } from "./landing-badge";

const STEPS = [
  {
    title: "Calm at first",
    body: "Out of the light, it’s a simple dark card with your guest’s name on it.",
  },
  {
    title: "Then it shimmers",
    body: "As light reaches the card, patterns rise from the surface: soft wavy lines, and a triangle made of tiny triangles.",
  },
  {
    title: "Colours that follow you",
    body: "Tilt it and the colours shift, like the foil on a trading card. It’s drawn live, right on your guest’s screen.",
  },
  {
    title: "Their name, pressed in",
    body: "Each guest’s name, your event and the date are set into the same shimmering surface.",
  },
];

const alex = demoCard("Alex", "Rivera");

export function Showcase({ control }: { control: RefObject<BadgeControl> }) {
  return (
    <section className="show js-show" id="badge">
      <div className="wrap show-grid">
        <div className="show-stage">
          <div className="etch etch-show" aria-hidden="true">
            <div className="etch-lines" />
          </div>
          <LandingBadge className="show-badge" data={alex} control={control} />
        </div>
        <div className="show-side">
          <div className="head">
            <p className="kicker">The badge</p>
            <h2 className="h2">
              A card that comes alive <span className="it">in the light.</span>
            </h2>
          </div>
          <div className="show-body">
            <div className="rail" aria-hidden="true">
              <div className="rail-fill js-rail-fill" />
            </div>
            <ol className="steps">
              {STEPS.map((s, i) => (
                <li key={s.title} className="step js-step">
                  <span className="num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <h3 className="h3">{s.title}</h3>
                  <p className="body">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
