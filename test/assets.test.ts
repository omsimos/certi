import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { getDb } from "../src/db";
import { ForbiddenError, ValidationError } from "../src/lib/errors";
import {
  isJpeg,
  isPng,
  MAX_LOGO_BYTES,
  removeEventLogo,
  saveEventLogo,
} from "../src/server/assets";
import { getEventByCode } from "../src/server/events";
import { createTestEvent, createTestUser } from "./helpers";

const db = getDb(env.DB);
const bucket = env.BUCKET;

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = (size = 64) => {
  const b = new Uint8Array(size);
  b.set(PNG_HEAD);
  return b;
};
const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);

describe("signatures", () => {
  it("detects PNG", () => {
    expect(isPng(png())).toBe(true);
    expect(isPng(jpeg())).toBe(false);
    expect(isPng(new Uint8Array([0x89, 0x50]))).toBe(false);
  });
  it("detects JPEG", () => {
    expect(isJpeg(jpeg())).toBe(true);
    expect(isJpeg(png())).toBe(false);
    expect(isJpeg(new Uint8Array([0xff]))).toBe(false);
  });
});

describe("saveEventLogo", () => {
  it("rejects a JPEG and an oversized PNG", async () => {
    const u = await createTestUser(db);
    const e = await createTestEvent(db, u.id);
    await expect(saveEventLogo(db, bucket, u.id, e.code, jpeg())).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(saveEventLogo(db, bucket, u.id, e.code, png(600 * 1024))).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect(MAX_LOGO_BYTES).toBe(512 * 1024);
    expect((await getEventByCode(db, e.code))?.logoKey).toBeNull();
  });

  it("rejects another owner", async () => {
    const a = await createTestUser(db);
    const b = await createTestUser(db);
    const e = await createTestEvent(db, a.id);
    await expect(saveEventLogo(db, bucket, b.id, e.code, png())).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("stores the key, bumps updatedAt and serves the bytes", async () => {
    const u = await createTestUser(db);
    const e = await createTestEvent(db, u.id);
    const saved = await saveEventLogo(db, bucket, u.id, e.code, png());
    expect(saved.logoKey).toBe(`logos/${e.id}/${saved.updatedAt.getTime()}.png`);
    expect(saved.updatedAt.getTime()).toBeGreaterThan(e.updatedAt.getTime());
    const obj = await bucket.get(saved.logoKey!);
    expect((await obj!.arrayBuffer()).byteLength).toBe(64);
  });

  it("deletes the previous object on a second upload", async () => {
    const u = await createTestUser(db);
    const e = await createTestEvent(db, u.id);
    const first = await saveEventLogo(db, bucket, u.id, e.code, png());
    const second = await saveEventLogo(db, bucket, u.id, e.code, png(80));
    expect(second.logoKey).not.toBe(first.logoKey);
    expect(await bucket.head(first.logoKey!)).toBeNull();
    expect(await bucket.head(second.logoKey!)).not.toBeNull();
  });
});

describe("removeEventLogo", () => {
  it("clears the key and deletes the object", async () => {
    const u = await createTestUser(db);
    const e = await createTestEvent(db, u.id);
    const saved = await saveEventLogo(db, bucket, u.id, e.code, png());
    const removed = await removeEventLogo(db, bucket, u.id, e.code);
    expect(removed.logoKey).toBeNull();
    expect(removed.updatedAt.getTime()).toBeGreaterThan(saved.updatedAt.getTime());
    expect(await bucket.head(saved.logoKey!)).toBeNull();
  });

  it("rejects another owner", async () => {
    const a = await createTestUser(db);
    const b = await createTestUser(db);
    const e = await createTestEvent(db, a.id);
    await expect(removeEventLogo(db, bucket, b.id, e.code)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
