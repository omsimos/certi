import type { RefObject } from "react";

import type { BadgeControl } from "@/lib/badge/pose";

import { demoCard, LandingBadge } from "./landing-badge";

const FLOW = [
  {
    title: "Add your guests",
    body: "Upload an Excel sheet with everyone’s name and email address.",
  },
  {
    title: "Choose the email picture",
    body: "Send a snapshot of the shimmering badge, made on your computer while the page is open, or a simpler flat version.",
  },
  {
    title: "Press send",
    body: "Nothing goes out until you say so. Long guest lists are spread over the next few days, to stay within the free daily email limit.",
  },
];

const alex = demoCard("Alex", "Rivera");

export function Delivery({ mailControl }: { mailControl: RefObject<BadgeControl> }) {
  return (
    <section className="flow js-flow" id="delivery">
      <div className="wrap flow-grid">
        <div className="flow-copy">
          <div className="head">
            <p className="kicker">How it works</p>
            <h2 className="h2">
              From a guest list <span className="it">to every inbox.</span>
            </h2>
          </div>
          <ol className="flow-steps js-flow-steps">
            {FLOW.map((s, i) => (
              <li key={s.title} className="flow-step js-flow-step">
                <span className="num" aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className="h3">{s.title}</h3>
                <p className="body">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="status js-reveal">
            <div className="status-head">
              <span className="h4">Email status</span>
              <span className="caption">4 guests</span>
            </div>
            <ul className="status-list">
              <li>
                <span className="who">
                  <span className="avatar" aria-hidden="true">
                    AR
                  </span>
                  Alex Rivera
                </span>
                <span className="state state-sent">
                  <span className="holo-tag holo-tag-outline">Sent</span>
                </span>
              </li>
              <li>
                <span className="who">
                  <span className="avatar" aria-hidden="true">
                    MO
                  </span>
                  Mara Okafor
                </span>
                <span className="state state-sent">
                  <span className="holo-tag holo-tag-outline">Sent</span>
                </span>
              </li>
              <li>
                <span className="who">
                  <span className="avatar" aria-hidden="true">
                    SL
                  </span>
                  Sam Lindqvist
                </span>
                <span className="state state-later">
                  <span className="holo-tag holo-tag-outline">Scheduled for Nov 15</span>
                </span>
              </li>
              <li>
                <span className="who">
                  <span className="avatar" aria-hidden="true">
                    JP
                  </span>
                  Jun Park
                </span>
                <span className="row-end">
                  <span className="state state-failed">
                    <span className="holo-tag">Failed</span>
                  </span>
                  <button type="button" className="holo-btn holo-btn-ghost holo-btn-sm">
                    Try again
                  </button>
                </span>
              </li>
            </ul>
          </div>
        </div>
        <article className="mail js-mail" aria-label="Example badge email">
          <div className="mail-head">
            <div className="mail-row">
              <span className="mail-k">From</span>
              <span>certi · badges@yourdomain.com</span>
            </div>
            <div className="mail-row">
              <span className="mail-k">To</span>
              <span>alex@example.com</span>
            </div>
            <div className="mail-row">
              <span className="mail-k">Subject</span>
              <span className="mail-subj">Your badge for Night Build 2026</span>
            </div>
          </div>
          <div className="mail-body">
            <p className="mail-h">Hi Alex, here’s your badge</p>
            <p className="mail-sub">Night Build 2026 · omsimos</p>
            <LandingBadge
              className="mail-img"
              data={alex}
              interactive={false}
              control={mailControl}
            />
            <a className="mail-btn" href="#try">
              View your badge
            </a>
            <p className="mail-foot">
              You’re receiving this because omsimos registered you for Night Build 2026.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
