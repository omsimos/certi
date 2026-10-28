import { describe, expect, it } from "vitest";
import { renderBadgeEmail, renderBadgeEmailDirect } from "../src/server/email/badge-email";

const data = {
  firstName: "Ana",
  eventTitle: "DevFest Manila",
  organizer: "GDG Manila",
  badgeUrl: "https://certi.example/event/devfest/badge/abcdefghij",
  imageUrl: "https://certi.example/api/badge/devfest/abcdefghij?v=1700000000000",
};

describe("renderBadgeEmail", () => {
  it("names the event in the subject", () => {
    expect(renderBadgeEmail(data).subject).toBe("Your badge for DevFest Manila");
  });

  it("links the versioned image to the badge page", () => {
    const { html } = renderBadgeEmail(data);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain(
      'src="https://certi.example/api/badge/devfest/abcdefghij?v=1700000000000"',
    );
    expect(html).toContain(`href="${data.badgeUrl}"`);
    expect(html).toContain('width="600"');
    expect(html).toContain('alt="Your badge for DevFest Manila"');
    expect(html).toContain("#090a0c");
    expect(html).toContain("Hi Ana, here&#x27;s your badge");
    expect(html).toContain("GDG Manila");
    expect(html).toContain("View your badge");
  });

  it("escapes attendee-supplied text", () => {
    const { html, text } = renderBadgeEmail({ ...data, firstName: "<script>x</script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(text).toContain("<script>x</script>");
  });

  it("carries the badge URL in the text part", () => {
    const { text } = renderBadgeEmail(data);
    expect(text).toContain(data.badgeUrl);
    expect(text).toContain("DevFest Manila");
  });

  it("matches a direct React render for hostile values", () => {
    const hostile = {
      firstName: `<img src=x onerror="alert('1')"> & __certi_eventTitle__`,
      eventTitle: `"Quotes" & 'apostrophes' <b>bold</b> $& $1`,
      organizer: "王小明 & محمد <Org>",
      badgeUrl: "https://certi.example/event/a&b/badge/x'y\"z",
      imageUrl: "https://certi.example/api/badge/a/b?v=1&x=<y>",
    };
    expect(renderBadgeEmail(hostile)).toEqual(renderBadgeEmailDirect(hostile));
    expect(renderBadgeEmail(data)).toEqual(renderBadgeEmailDirect(data));
  });
});
