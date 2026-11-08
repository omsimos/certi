import { describe, expect, it } from "vitest";
import { buildPreviewDocument } from "../src/lib/email-preview-document";

describe("buildPreviewDocument", () => {
  const d = {
    firstName: "Ana",
    eventTitle: "DevFest Manila",
    organizer: "GDG Manila",
    badgeUrl: "https://certi.example/event/devfest/badge/abcdefghij",
    imageUrl: "data:image/jpeg;base64,AAAA",
  };

  it("embeds the image, badge link and greeting", () => {
    const { html } = buildPreviewDocument(d);
    expect(html).toContain(`src="${d.imageUrl}"`);
    expect(html).toContain(`href="${d.badgeUrl}"`);
    expect(html).toContain("Hi Ana");
  });

  it("uses the real subject", () => {
    expect(buildPreviewDocument(d).subject).toBe("Your badge for DevFest Manila");
  });
});
