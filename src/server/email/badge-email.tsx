import type { CSSProperties } from "react";
import { renderToStaticMarkup } from "react-dom/server";

type BadgeEmailData = {
  firstName: string;
  eventTitle: string;
  organizer: string;
  badgeUrl: string;
  imageUrl: string;
};

const BG = "#090a0c";
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const heading: CSSProperties = {
  fontFamily: FONT,
  fontSize: 24,
  lineHeight: "32px",
  fontWeight: 600,
  color: "#f4f4f5",
};
const subline: CSSProperties = {
  fontFamily: FONT,
  fontSize: 15,
  lineHeight: "22px",
  color: "#a1a1aa",
  paddingTop: 8,
};
const button: CSSProperties = {
  display: "inline-block",
  fontFamily: FONT,
  fontSize: 15,
  fontWeight: 600,
  color: BG,
  backgroundColor: "#f4f4f5",
  borderRadius: 999,
  padding: "12px 28px",
  textDecoration: "none",
};
const footer: CSSProperties = {
  fontFamily: FONT,
  fontSize: 12,
  lineHeight: "18px",
  color: "#71717a",
  paddingTop: 32,
};

// Email clients ignore most modern CSS, so layout is nested tables with inline styles.
function BadgeEmail({ d, subject }: { d: BadgeEmailData; subject: string }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="dark" />
        <title>{subject}</title>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: BG }}>
        <table
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          border={0}
          style={{ backgroundColor: BG }}
        >
          <tbody>
            <tr>
              <td align="center" style={{ padding: "32px 16px" }}>
                <table
                  role="presentation"
                  width={600}
                  cellPadding={0}
                  cellSpacing={0}
                  border={0}
                  style={{ width: "100%", maxWidth: 600 }}
                >
                  <tbody>
                    <tr>
                      <td style={heading}>{`Hi ${d.firstName}, here's your badge`}</td>
                    </tr>
                    <tr>
                      <td style={subline}>{`${d.eventTitle} · ${d.organizer}`}</td>
                    </tr>
                    <tr>
                      <td style={{ paddingTop: 24 }}>
                        <a href={d.badgeUrl}>
                          <img
                            src={d.imageUrl}
                            width={600}
                            alt={subject}
                            style={{
                              display: "block",
                              width: "100%",
                              maxWidth: 600,
                              height: "auto",
                              border: 0,
                            }}
                          />
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style={{ paddingTop: 24 }}>
                        <a href={d.badgeUrl} style={button}>
                          View your badge
                        </a>
                      </td>
                    </tr>
                    <tr>
                      <td align="center" style={footer}>
                        {`You're receiving this because ${d.organizer} registered you for ${d.eventTitle}.`}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

type RenderedEmail = { subject: string; html: string; text: string };

const subjectOf = (d: BadgeEmailData) => `Your badge for ${d.eventTitle}`;
const textOf = (d: BadgeEmailData) =>
  [
    `Hi ${d.firstName}, here's your badge for ${d.eventTitle} (${d.organizer}).`,
    "",
    `View your badge: ${d.badgeUrl}`,
  ].join("\n");

// The React render itself; used once to build the template, and by tests as the reference.
export function renderBadgeEmailDirect(d: BadgeEmailData): RenderedEmail {
  const subject = subjectOf(d);
  const html = `<!doctype html>${renderToStaticMarkup(<BadgeEmail d={d} subject={subject} />)}`;
  return { subject, html, text: textOf(d) };
}

const FIELDS = ["firstName", "eventTitle", "organizer", "badgeUrl", "imageUrl"] as const;
// Plain word characters, so React's escaping leaves them untouched in text and attributes.
const token = (field: string) => `__certi_${field}__`;
const TOKEN_RE = new RegExp(FIELDS.map(token).join("|"), "g");
const fieldOf = new Map<string, keyof BadgeEmailData>(FIELDS.map((f) => [token(f), f]));

// The same entities React emits, so a substituted render equals a direct one.
const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
};
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ENTITIES[c]);

let template: RenderedEmail | undefined;

// Rendering React per attendee costs too much CPU for a Workers Free request, so the
// markup is rendered once with tokens and each email only substitutes its values.
// One pass, so a value that looks like a token is never substituted again.
export function renderBadgeEmail(d: BadgeEmailData): RenderedEmail {
  template ??= renderBadgeEmailDirect(
    Object.fromEntries(FIELDS.map((f) => [f, token(f)])) as BadgeEmailData,
  );
  const fill = (s: string, escape: (v: string) => string) =>
    s.replace(TOKEN_RE, (t) => escape(d[fieldOf.get(t)!]));
  return {
    subject: fill(template.subject, (v) => v),
    html: fill(template.html, escapeHtml),
    text: fill(template.text, (v) => v),
  };
}
