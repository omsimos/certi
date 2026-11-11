import { useEffect, useRef, useState } from "react";

import type { HoloBadgeHandle } from "@/components/badge/holo-badge";
import { createBadgeControl, STILL_POSE, sweepPose } from "@/lib/badge/pose";

import { demoCard, LandingBadge } from "./landing-badge";

const FORMATS = [
  { name: "Picture", note: "A still of the badge, just as it looks on screen.", tag: "PNG" },
  { name: "Video", note: "The four-second shimmer loop, at full size.", tag: "MP4" },
  { name: "Animated image", note: "The same loop, as an animated image.", tag: "WebP" },
  { name: "Animated GIF", note: "Plays wherever GIFs do.", tag: "GIF" },
];

const FRAMES = 6;
const LOOP_MS = 4000;

const jun = demoCard("Jun", "Park", "0087");

export function Exports() {
  const badge = useRef<HoloBadgeHandle>(null);
  const loop = useRef(createBadgeControl());
  const [backend, setBackend] = useState<HoloBadgeHandle["backend"] | null>(null);
  const [frames, setFrames] = useState<string[]>([]);

  // Plays the export loop itself, so the live card previews the downloadable animation.
  useEffect(() => {
    const t0 = performance.now();
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const control = loop.current;
    control.driver = () =>
      reduce.matches ? STILL_POSE : sweepPose(((performance.now() - t0) / LOOP_MS) % 1);
    return () => {
      control.driver = null;
    };
  }, []);

  // The filmstrip: stills of the same loop from the loop badge, instead of six more live canvases.
  useEffect(() => {
    const handle = badge.current;
    if (!backend || !handle) return;
    let cancelled = false;
    const urls: string[] = [];
    (async () => {
      for (let i = 0; i < FRAMES; i++) {
        const blob = await handle.renderStill({
          width: 270,
          height: 384,
          type: "image/png",
          pose: sweepPose(i / FRAMES),
        });
        if (cancelled) return;
        urls.push(URL.createObjectURL(blob));
      }
      setFrames(urls);
    })().catch((err) => {
      // A WebGPU failure here is followed by a "flat" backend change, which retries.
      if (!cancelled) console.error(err);
    });
    return () => {
      cancelled = true;
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, [backend]);

  return (
    <section className="exports js-exports" id="exports">
      <div className="wrap exports-grid">
        <div className="exports-stage">
          <LandingBadge
            ref={badge}
            className="loop-badge"
            data={jun}
            interactive={false}
            control={loop}
            onBackendChange={setBackend}
          />
          <p className="holo-hint">The four-second loop guests can save</p>
        </div>
        <div className="exports-copy">
          <div className="head">
            <p className="kicker">Keep and share</p>
            <h2 className="h2">
              Theirs to keep, <span className="it">and to share.</span>
            </h2>
          </div>
          <p className="lede">
            Guests can save their badge from its page as a picture, a video or a looping animation.
            It’s made right in their browser when they press download.
          </p>
          <ul className="formats js-formats">
            {FORMATS.map((f) => (
              <li key={f.tag} className="format js-format">
                <span className="fmt-text">
                  <span className="fmt-name">{f.name}</span>
                  <span className="fmt-note">{f.note}</span>
                </span>
                <span className="holo-tag holo-tag-outline">{f.tag}</span>
              </li>
            ))}
          </ul>
          <p className="caption">
            On browsers that can’t show the effect, guests see a flat version of the card and can
            still save the picture.
          </p>
        </div>
      </div>
      <div className="strip-viewport js-strip-viewport" aria-hidden="true">
        <div className="strip js-strip">
          {Array.from({ length: FRAMES }, (_, i) => (
            <figure key={i} className="frame js-frame">
              <div className="slot frame-badge">
                {frames[i] ? (
                  <img src={frames[i]} alt="" width={270} height={384} />
                ) : (
                  <div className="slot-ph" />
                )}
              </div>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
