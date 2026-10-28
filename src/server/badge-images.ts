import { and, eq } from "drizzle-orm";

import type { DB } from "@/db";
import { attendee, event } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { eventCodeSchema } from "@/lib/schemas";
import { isJpeg } from "@/server/assets";
import { getOwnedEvent } from "@/server/events";

export const MAX_BADGE_IMAGE_BYTES = 1024 * 1024;

export const attendeeIdSchema = /^[A-Za-z0-9_-]{10}$/;

export const badgeImageKey = (attendeeId: string, version: Date) =>
  `badges/v1/${attendeeId}/${version.getTime()}.jpg`;

// Size is checked here so an oversized upload is rejected before it is buffered.
export function parseBadgeImageUpload(d: unknown): {
  code: string;
  attendeeId: string;
  version: number;
  file: File;
} {
  if (!(d instanceof FormData)) throw new ValidationError("Invalid upload");
  const code = eventCodeSchema.safeParse(d.get("code"));
  const attendeeId = d.get("attendeeId");
  const rawVersion = d.get("version");
  const file = d.get("file");
  const version = typeof rawVersion === "string" && /^\d+$/.test(rawVersion) ? +rawVersion : 0;
  if (
    !code.success ||
    typeof attendeeId !== "string" ||
    !attendeeIdSchema.test(attendeeId) ||
    !Number.isSafeInteger(version) ||
    version <= 0 ||
    !(file instanceof File)
  ) {
    throw new ValidationError("Invalid upload");
  }
  if (file.size > MAX_BADGE_IMAGE_BYTES)
    throw new ValidationError("Badge image must be 1 MB or smaller");
  return { code: code.data, attendeeId, version, file };
}

export async function saveBadgeImage(
  db: DB,
  bucket: R2Bucket,
  ownerId: string,
  code: string,
  attendeeId: string,
  bytes: Uint8Array,
  version: number,
): Promise<void> {
  const ev = await getOwnedEvent(db, ownerId, code);
  if (bytes.length > MAX_BADGE_IMAGE_BYTES) {
    throw new ValidationError("Badge image must be 1 MB or smaller");
  }
  if (!isJpeg(bytes)) throw new ValidationError("Badge image must be a JPEG");
  // An image rendered before an event edit would show stale details.
  if (version !== ev.updatedAt.getTime()) throw new ValidationError("Event changed, re-render");

  const [prev] = await db
    .select({ key: attendee.badgeImageKey })
    .from(attendee)
    .where(and(eq(attendee.id, attendeeId), eq(attendee.eventId, ev.id)))
    .limit(1);
  if (!prev) throw new NotFoundError("Attendee not found");

  const key = badgeImageKey(attendeeId, ev.updatedAt);
  // Object first, row second: a failed update must never leave the row pointing at nothing.
  await bucket.put(key, bytes, { httpMetadata: { contentType: "image/jpeg" } });
  try {
    await db
      .update(attendee)
      .set({ badgeImageKey: key, badgeImageVersion: ev.updatedAt })
      .where(and(eq(attendee.id, attendeeId), eq(attendee.eventId, ev.id)));
  } catch (err) {
    // A same-version re-upload overwrote the live object, so only a new key is safe to remove.
    if (key !== prev.key) await bucket.delete(key).catch(() => undefined);
    throw err;
  }
  if (prev.key && prev.key !== key) await bucket.delete(prev.key);
}

export async function getBadgeImageKey(
  db: DB,
  code: string,
  attendeeId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ key: attendee.badgeImageKey })
    .from(attendee)
    .innerJoin(event, eq(attendee.eventId, event.id))
    .where(and(eq(event.code, code), eq(attendee.id, attendeeId)))
    .limit(1);
  return row?.key ?? null;
}

export async function getBadgeImage(
  db: DB,
  bucket: R2Bucket,
  code: string,
  attendeeId: string,
): Promise<{ key: string; body: ReadableStream } | null> {
  const key = await getBadgeImageKey(db, code, attendeeId);
  if (!key) return null;
  const obj = await bucket.get(key);
  return obj ? { key, body: obj.body } : null;
}
