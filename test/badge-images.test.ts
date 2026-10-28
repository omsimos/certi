import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { getDb } from "../src/db";
import { attendee, event } from "../src/db/schema";
import { ForbiddenError, NotFoundError, ValidationError } from "../src/lib/errors";
import {
  badgeImageKey,
  getBadgeImage,
  MAX_BADGE_IMAGE_BYTES,
  parseBadgeImageUpload,
  saveBadgeImage,
} from "../src/server/badge-images";
import { createTestEvent, createTestUser } from "./helpers";

const db = getDb(env.DB);
const bucket = env.BUCKET;

const jpeg = (size = 64) => {
  const b = new Uint8Array(size);
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return b;
};
const png = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function setup() {
  const u = await createTestUser(db);
  const e = await createTestEvent(db, u.id);
  const id = nanoid(10);
  await db
    .insert(attendee)
    .values({ id, eventId: e.id, firstName: "A", lastName: "B", email: `${id}@example.com` });
  return { u, e, id };
}

describe("badgeImageKey", () => {
  it("embeds the attendee and version", () => {
    expect(badgeImageKey("abcdefghij", new Date(1234))).toBe("badges/v1/abcdefghij/1234.jpg");
  });
});

describe("saveBadgeImage", () => {
  it("returns null from getBadgeImage before an upload", async () => {
    const { e, id } = await setup();
    expect(await getBadgeImage(db, bucket, e.code, id)).toBeNull();
  });

  it("stores the image, sets the version and serves it", async () => {
    const { u, e, id } = await setup();
    await saveBadgeImage(db, bucket, u.id, e.code, id, jpeg(), e.updatedAt.getTime());
    const img = await getBadgeImage(db, bucket, e.code, id);
    expect(img?.key).toBe(badgeImageKey(id, e.updatedAt));
    expect((await new Response(img!.body).arrayBuffer()).byteLength).toBe(64);
  });

  it("rejects a PNG, an oversized JPEG and a stale version", async () => {
    const { u, e, id } = await setup();
    const v = e.updatedAt.getTime();
    await expect(saveBadgeImage(db, bucket, u.id, e.code, id, png(), v)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      saveBadgeImage(db, bucket, u.id, e.code, id, jpeg(1.1 * 1024 * 1024), v),
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(saveBadgeImage(db, bucket, u.id, e.code, id, jpeg(), v - 1)).rejects.toThrow(
      "Event changed, re-render",
    );
    expect(await getBadgeImage(db, bucket, e.code, id)).toBeNull();
  });

  it("rejects an attendee of another event and another owner", async () => {
    const a = await setup();
    const other = await setup();
    const v = a.e.updatedAt.getTime();
    await expect(
      saveBadgeImage(db, bucket, a.u.id, a.e.code, other.id, jpeg(), v),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      saveBadgeImage(db, bucket, other.u.id, a.e.code, a.id, jpeg(), v),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("deletes the old object when replaced by a newer version", async () => {
    const { u, e, id } = await setup();
    await saveBadgeImage(db, bucket, u.id, e.code, id, jpeg(), e.updatedAt.getTime());
    const first = badgeImageKey(id, e.updatedAt);
    // Simulate the event changing, which moves the required version forward.
    const next = new Date(e.updatedAt.getTime() + 1000);
    await db.update(event).set({ updatedAt: next }).where(eq(event.id, e.id));
    await saveBadgeImage(db, bucket, u.id, e.code, id, jpeg(80), next.getTime());
    expect(await bucket.head(first)).toBeNull();
    expect(await bucket.head(badgeImageKey(id, next))).not.toBeNull();
  });

  it("keeps the object when the same version is re-uploaded", async () => {
    const { u, e, id } = await setup();
    const v = e.updatedAt.getTime();
    await saveBadgeImage(db, bucket, u.id, e.code, id, jpeg(), v);
    await saveBadgeImage(db, bucket, u.id, e.code, id, jpeg(90), v);
    const img = await getBadgeImage(db, bucket, e.code, id);
    expect((await new Response(img!.body).arrayBuffer()).byteLength).toBe(90);
  });
});

describe("parseBadgeImageUpload", () => {
  const file = (size = 10) => new File([new Uint8Array(size)], "b.jpg", { type: "image/jpeg" });
  const form = (over: Record<string, unknown> = {}) => {
    const f = new FormData();
    const vals: Record<string, unknown> = {
      code: "abc-123",
      attendeeId: "abcdefghij",
      version: "1700000000000",
      file: file(),
      ...over,
    };
    for (const [k, v] of Object.entries(vals)) if (v !== undefined) f.set(k, v as string | Blob);
    return f;
  };

  it.each([
    ["not FormData", { code: "abc-123" }],
    ["missing code", form({ code: undefined })],
    ["malformed code", form({ code: "A B!" })],
    ["missing attendeeId", form({ attendeeId: undefined })],
    ["malformed attendeeId", form({ attendeeId: "short" })],
    ["missing version", form({ version: undefined })],
    ["zero version", form({ version: "0" })],
    ["fractional version", form({ version: "1.5" })],
    ["non-numeric version", form({ version: "abc" })],
    ["missing file", form({ file: undefined })],
    ["non-File file", form({ file: "text" })],
    ["oversized file", form({ file: file(MAX_BADGE_IMAGE_BYTES + 1) })],
  ])("rejects %s", (_n, input) => {
    expect(() => parseBadgeImageUpload(input)).toThrow(ValidationError);
  });

  it("accepts a valid upload", () => {
    const out = parseBadgeImageUpload(form({ file: file(MAX_BADGE_IMAGE_BYTES) }));
    expect(out).toMatchObject({
      code: "abc-123",
      attendeeId: "abcdefghij",
      version: 1700000000000,
    });
    expect(out.file.size).toBe(MAX_BADGE_IMAGE_BYTES);
  });
});
