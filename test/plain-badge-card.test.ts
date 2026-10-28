import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlainBadgeCard } from "../src/components/badge/plain-badge-card";

describe("PlainBadgeCard", () => {
  it("shows the name, event, organizer and date as text", () => {
    const html = renderToStaticMarkup(
      createElement(PlainBadgeCard, {
        data: {
          firstName: "Maria Clara",
          lastName: "Dela Cruz",
          eventTitle: "DevCon <Manila>",
          organizer: "DevCon PH",
          date: "November 5, 2026",
          attendeeId: "a1b2c3d4e5",
          badgeUrl: "https://certi.test/event/ABC123/badge/a1b2c3d4e5",
        },
      }),
    );
    for (const text of [
      "Maria Clara",
      "Dela Cruz",
      "DevCon &lt;Manila&gt;",
      "DevCon PH",
      "November 5, 2026",
    ]) {
      expect(html).toContain(text);
    }
  });
});
