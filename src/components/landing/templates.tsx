import { cn } from "@/lib/utils";

import { demoCard, LandingBadge } from "./landing-badge";

export const ACCENTS = [
  { hex: "#6d3cff", name: "Violet" },
  { hex: "#f53a68", name: "Rose" },
  { hex: "#24cfdf", name: "Cyan" },
  { hex: "#5aeba0", name: "Mint" },
  { hex: "#ee814d", name: "Coral" },
];

const alex = demoCard("Alex", "Rivera");
const mara = demoCard("Mara", "Okafor", "0031");
const sam = demoCard("Sam", "Lindqvist", "0117");

export function Templates({
  accent,
  onAccent,
}: {
  accent: string;
  onAccent: (hex: string) => void;
}) {
  const current = ACCENTS.find((a) => a.hex === accent);
  return (
    <section className="tpl js-tpl" id="templates">
      <div className="wrap head tpl-head">
        <p className="kicker">Designs</p>
        <h2 className="h2">
          One look for <span className="it">your whole event.</span>
        </h2>
        <p className="lede">
          Choose a design when you set up your event, and every guest’s badge will follow it.
        </p>
      </div>
      <div className="tpl-viewport">
        <div className="tpl-track js-tpl-track">
          <article className="tpl-panel">
            <LandingBadge className="tpl-badge" data={alex} />
            <div className="tpl-copy">
              <h3 className="tpl-name">
                Graphite <span className="tpl-tag">The default</span>
              </h3>
              <p className="body">
                Dark and simple, with the certi mark at the top and each guest’s name along the
                bottom.
              </p>
            </div>
          </article>
          <article className="tpl-panel">
            <LandingBadge className="tpl-badge" template="branded" accent={accent} data={mara} />
            <div className="tpl-copy">
              <h3 className="tpl-name">Branded</h3>
              <p className="body">
                Your colour and logo, blended into the dark card. Try a colour:
              </p>
              <div className="swatch-row">
                <div className="swatches" role="group" aria-label="Badge colour">
                  {ACCENTS.map((a) => (
                    <button
                      key={a.hex}
                      type="button"
                      className={cn("swatch", a.hex === accent && "is-on")}
                      aria-label={a.name}
                      aria-pressed={a.hex === accent}
                      onClick={() => onAccent(a.hex)}
                    >
                      <span className="swatch-dot" style={{ background: a.hex }} />
                    </button>
                  ))}
                </div>
                <span className="swatch-name">{current ? current.name : "Custom"}</span>
              </div>
            </div>
          </article>
          <article className="tpl-panel">
            <LandingBadge className="tpl-badge" template="id" data={sam} />
            <div className="tpl-copy">
              <h3 className="tpl-name">ID</h3>
              <p className="body">
                Sets the name big in the middle and adds a QR code that opens the guest’s badge
                page.
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
