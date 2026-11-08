import { createFileRoute } from "@tanstack/react-router";

import { demoCard, LandingBadge } from "@/components/landing/landing-badge";
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
  return (
    <div className="landing">
      <div className="grain" aria-hidden="true" />
      <LandingBadge className="hero-badge" data={demoCard("Alex", "Rivera")} />
    </div>
  );
}
