import { and, eq } from "drizzle-orm";

import type { DB } from "@/db";
import { event, type Event } from "@/db/schema";
import { MAX_LOGO_BYTES } from "@/lib/badge/logo-limits";
import { ValidationError } from "@/lib/errors";
import { eventCodeSchema } from "@/lib/schemas";
import { getOwnedEvent, nextUpdatedAt } from "@/server/events";

// Shared with the client rasterizer, which must not import this db-bound module.
export { MAX_LOGO_BYTES };

const startsWith = (bytes: Uint8Array, sig: number[]) =>
  bytes.length >= sig.length && sig.every((b, i) => bytes[i] === b);

export const isPng = (bytes: Uint8Array) =>
  startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const isJpeg = (bytes: Uint8Array) => startsWith(bytes, [0xff, 0xd8, 0xff]);

// Size is checked here so an oversized upload is rejected before it is buffered.
export function parseLogoUpload(d: unknown): { code: string; file: File } {
  if (!(d instanceof FormData)) throw new ValidationError("Invalid upload");
  const code = eventCodeSchema.safeParse(d.get("code"));
  const file = d.get("file");
  if (!code.success || !(file instanceof File)) throw new ValidationError("Invalid upload");
  if (file.size > MAX_LOGO_BYTES) throw new ValidationError("Logo must be 512 KB or smaller");
  return { code: code.data, file };
}

async function setLogoKey(
  db: DB,
  prev: Event,
  logoKey: string | null,
  updatedAt: Date,
): Promise<Event> {
  const [row] = await db
    .update(event)
    .set({ logoKey, updatedAt })
    .where(and(eq(event.id, prev.id), eq(event.ownerId, prev.ownerId)))
    .returning();
  return row;
}

export async function saveEventLogo(
  db: DB,
  bucket: R2Bucket,
  ownerId: string,
  code: string,
  bytes: Uint8Array,
): Promise<Event> {
  const prev = await getOwnedEvent(db, ownerId, code);
  if (bytes.length > MAX_LOGO_BYTES) throw new ValidationError("Logo must be 512 KB or smaller");
  // The browser rasterizes every logo to PNG, so anything else is not from our client.
  if (!isPng(bytes)) throw new ValidationError("Logo must be a PNG");

  const updatedAt = nextUpdatedAt(prev);
  const key = `logos/${prev.id}/${updatedAt.getTime()}.png`;
  // Object first, row second: a failed update must never leave the row pointing at nothing.
  await bucket.put(key, bytes, { httpMetadata: { contentType: "image/png" } });
  let row: Event;
  try {
    row = await setLogoKey(db, prev, key, updatedAt);
  } catch (err) {
    await bucket.delete(key).catch(() => undefined);
    throw err;
  }
  if (prev.logoKey) await bucket.delete(prev.logoKey);
  return row;
}

export async function removeEventLogo(
  db: DB,
  bucket: R2Bucket,
  ownerId: string,
  code: string,
): Promise<Event> {
  const prev = await getOwnedEvent(db, ownerId, code);
  if (!prev.logoKey) return prev;
  const row = await setLogoKey(db, prev, null, nextUpdatedAt(prev));
  await bucket.delete(prev.logoKey);
  return row;
}
