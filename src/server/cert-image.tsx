import { cache, GoogleFont, render } from "@cf-wasm/og/workerd";
import { waitUntil } from "cloudflare:workers";

import type { CertificateData } from "@/server/cert-png";

const WIDTH = 1200;
const HEIGHT = 630;

// Satori cannot do writing-mode, so the ID is rotated instead. The card colors
// mirror the HTML ticket (bg-foreground / text-background).
const INK = "#020817";
const PAPER = "#f8fafc";
const LONG_NAME = 30;

// Geist covers Latin-1 (María, Ñúñez). Anything beyond that falls through to a
// Noto Sans SC subset cut to just the glyphs on this certificate.
// U+2010-205E is general punctuation (dashes, quotes), which Geist also has.
function needsFallback(text: string): boolean {
  return [...text].some((c) => {
    const cp = c.codePointAt(0)!;
    return cp > 0xff && !(cp >= 0x2010 && cp <= 0x205e);
  });
}

export async function renderCertificatePng(d: CertificateData): Promise<ArrayBuffer> {
  cache.setExecutionContext({ waitUntil });

  const name = `${d.firstName} ${d.lastName}`;
  const body = `${d.eventTitle}${d.organizer}${d.date}`;
  const fonts = [
    new GoogleFont("Geist", { name: "Geist", weight: 400 }),
    new GoogleFont("Geist", { name: "Geist", weight: 700 }),
  ];
  if (needsFallback(name + body)) {
    // Font bytes are memoised per css URL by the library, so an identical text
    // subset is only fetched once per isolate.
    const text = [...new Set(name + body)].sort().join("");
    fonts.push(
      new GoogleFont("Noto Sans SC", { name: "Noto Sans SC", weight: 400, text }),
      new GoogleFont("Noto Sans SC", { name: "Noto Sans SC", weight: 700, text }),
    );
  }

  const { image } = await render(<Certificate {...d} />, {
    width: WIDTH,
    height: HEIGHT,
    fonts,
  }).asPng();
  return image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength) as ArrayBuffer;
}

function Certificate({
  firstName,
  lastName,
  eventTitle,
  organizer,
  date,
  attendeeId,
}: CertificateData) {
  const name = `${firstName} ${lastName}`;
  // Satori has no inline flow, so the sentence is laid out word by word to let
  // the bold title sit mid-sentence and still wrap.
  const split = (text: string, bold: boolean) =>
    text
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => ({ text: t, bold }));
  const words = [
    ...split("Has successfully participated in", false),
    ...split(eventTitle, true),
    ...split(`by ${organizer} held on ${date}.`, false),
  ];
  const nameSize = name.length > LONG_NAME ? 44 : 68;
  const notch = {
    position: "absolute",
    top: 215,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#ffffff",
  } as const;

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        padding: 40,
        backgroundColor: "#ffffff",
        fontFamily: "Geist, Noto Sans SC, sans serif",
      }}
    >
      <div
        style={{
          display: "flex",
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          borderRadius: 32,
          backgroundColor: INK,
          color: PAPER,
        }}
      >
        <div style={{ ...notch, left: -150 }} />
        <div style={{ ...notch, right: -150 }} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            padding: "72px 72px 72px 96px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: nameSize,
              fontWeight: 700,
              letterSpacing: -2,
              lineHeight: 1.1,
              wordBreak: "break-word",
            }}
          >
            {name}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", flexWrap: "wrap", fontSize: 32, lineHeight: 1.4 }}>
              {words.map((w, i) => (
                <span
                  key={i}
                  style={{
                    maxWidth: "100%",
                    marginRight: 9,
                    wordBreak: "break-word",
                    fontWeight: w.bold ? 700 : 400,
                  }}
                >
                  {w.text}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", marginTop: 32, fontSize: 22, opacity: 0.6 }}>
              <span>Powered by&nbsp;</span>
              <span style={{ fontWeight: 700 }}>OMSIMOS</span>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 150,
            borderLeft: `3px dashed ${PAPER}`,
            marginRight: 40,
            paddingLeft: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              flexShrink: 0,
              width: 400,
              fontSize: 30,
              whiteSpace: "nowrap",
              transform: "rotate(90deg)",
            }}
          >
            {attendeeId}
          </div>
        </div>
      </div>
    </div>
  );
}
