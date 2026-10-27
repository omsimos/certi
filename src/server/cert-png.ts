import type { DB } from "@/db";
import { formatEventDate } from "@/lib/format";
import { getCertificate } from "@/server/attendees";

export type CertificateData = {
  firstName: string;
  lastName: string;
  eventTitle: string;
  organizer: string;
  date: string;
  attendeeId: string;
};

// Bump when cert-image.tsx changes: cached PNGs are keyed on event data only, so
// without a new version they would keep serving the old design.
export const CERT_TEMPLATE_VERSION = 1;

// Keyed on the event's updatedAt so editing an event invalidates every certificate
// without having to enumerate and delete objects.
export function certPngKey(attendeeId: string, eventUpdatedAt: Date): string {
  return `certs/v${CERT_TEMPLATE_VERSION}/${attendeeId}/${eventUpdatedAt.getTime()}.png`;
}

// The key embeds the template and event versions, so it changes exactly when the image does.
export function certEtag(key: string): string {
  return `"${key}"`;
}

type Deps = {
  db: DB;
  bucket: R2Bucket;
  render: (d: CertificateData) => Promise<ArrayBuffer>;
};

// Rendering is injected so the cache logic stays free of the WASM renderer.
export async function getCertificatePng(
  deps: Deps,
  code: string,
  attendeeId: string,
): Promise<ArrayBuffer | null> {
  return (await getCertificatePngWithKey(deps, code, attendeeId))?.png ?? null;
}

// The route also needs the R2 key, which doubles as the response ETag. When
// `ifNoneMatch` matches it, `png` is null and neither R2 nor the renderer is touched.
export async function getCertificatePngWithKey(
  deps: Deps,
  code: string,
  attendeeId: string,
  opts: { ifNoneMatch?: string | null } = {},
): Promise<{ png: ArrayBuffer | null; key: string } | null> {
  const cert = await getCertificate(deps.db, code, attendeeId);
  if (!cert) return null;

  const key = certPngKey(attendeeId, cert.event.updatedAt);
  if (etagMatches(opts.ifNoneMatch ?? null, certEtag(key))) return { png: null, key };
  const cached = await deps.bucket.get(key);
  if (cached) return { png: await cached.arrayBuffer(), key };

  const png = await deps.render({
    firstName: cert.attendee.firstName,
    lastName: cert.attendee.lastName,
    eventTitle: cert.event.title,
    organizer: cert.event.organizer,
    date: formatEventDate(cert.event.date),
    attendeeId,
  });
  // An empty body would be cached under this key until the event is next edited.
  if (png.byteLength === 0) throw new Error("Certificate render produced an empty image");
  await deps.bucket.put(key, png, { httpMetadata: { contentType: "image/png" } });
  return { png, key };
}

// If-None-Match may carry a list, weak validators (W/"...") or `*`.
export function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false;
  return header.split(",").some((part) => {
    const tag = part.trim().replace(/^W\//, "");
    return tag === "*" || tag === etag;
  });
}
