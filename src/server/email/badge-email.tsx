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

export function renderBadgeEmail(d: BadgeEmailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Your badge for ${d.eventTitle}`;
  const html = `<!doctype html>${renderToStaticMarkup(<BadgeEmail d={d} subject={subject} />)}`;
  const text = [
    `Hi ${d.firstName}, here's your badge for ${d.eventTitle} (${d.organizer}).`,
    "",
    `View your badge: ${d.badgeUrl}`,
  ].join("\n");
  return { subject, html, text };
}
