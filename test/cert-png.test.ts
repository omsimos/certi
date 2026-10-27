import { env } from "cloudflare:workers";
import { nanoid } from "nanoid";
import { describe, expect, it, vi } from "vitest";
import { getDb } from "../src/db";
import { attendee } from "../src/db/schema";
import { certPngKey, etagMatches, getCertificatePng } from "../src/server/cert-png";
import { updateEvent } from "../src/server/events";
import { createTestEvent, createTestUser } from "./helpers";

const db = getDb(env.DB);

async function setup() {
  const owner = await createTestUser(db);
  const ev = await createTestEvent(db, owner.id);
  const id = nanoid(10);
  await db.insert(attendee).values({
    id,
    eventId: ev.id,
    firstName: "Ana",
    lastName: "Cruz",
    email: `${id.toLowerCase()}@x.com`,
  });
  const render = vi.fn(async () => new Uint8Array([1, 2, 3]).buffer as ArrayBuffer);
  const deps = { db, bucket: env.BUCKET, render };
  return { owner, ev, id, render, deps };
}

describe("getCertificatePng", () => {
  it("returns null and does not render for an unknown attendee", async () => {
    const { ev, deps, render } = await setup();
    expect(await getCertificatePng(deps, ev.code, "nope000000")).toBeNull();
    expect(await getCertificatePng(deps, "no-such-event", "nope000000")).toBeNull();
    expect(render).not.toHaveBeenCalled();
  });

  it("renders once, then serves from R2", async () => {
    const { ev, id, deps, render } = await setup();
    const first = await getCertificatePng(deps, ev.code, id);
    const second = await getCertificatePng(deps, ev.code, id);
    expect(new Uint8Array(first!)).toEqual(new Uint8Array([1, 2, 3]));
    expect(new Uint8Array(second!)).toEqual(new Uint8Array([1, 2, 3]));
    expect(render).toHaveBeenCalledTimes(1);
    const obj = await env.BUCKET.get(certPngKey(id, ev.updatedAt));
    expect(obj).not.toBeNull();
    expect(obj!.httpMetadata?.contentType).toBe("image/png");
  });

  it("re-renders after the event is updated", async () => {
    const { owner, ev, id, deps, render } = await setup();
    await getCertificatePng(deps, ev.code, id);
    await updateEvent(db, owner.id, ev.code, {
      title: "Renamed Event",
      description: ev.description,
      organizer: ev.organizer,
      date: ev.date,
    });
    await getCertificatePng(deps, ev.code, id);
    expect(render).toHaveBeenCalledTimes(2);
  });

  it("passes the event and attendee fields to render", async () => {
    const { ev, id, deps, render } = await setup();
    await getCertificatePng(deps, ev.code, id);
    expect(render).toHaveBeenCalledWith({
      firstName: "Ana",
      lastName: "Cruz",
      eventTitle: ev.title,
      organizer: ev.organizer,
      date: "January 15, 2026",
      attendeeId: id,
    });
  });

  it("throws and caches nothing when render returns an empty image", async () => {
    const { ev, id, deps } = await setup();
    const empty = vi.fn(async () => new ArrayBuffer(0));
    await expect(getCertificatePng({ ...deps, render: empty }, ev.code, id)).rejects.toThrow(
      /empty/,
    );
    expect(await env.BUCKET.get(certPngKey(id, ev.updatedAt))).toBeNull();
  });

  it("does not cache when render fails", async () => {
    const { ev, id, deps } = await setup();
    const failing = vi.fn(async () => {
      throw new Error("font fetch failed");
    });
    await expect(getCertificatePng({ ...deps, render: failing }, ev.code, id)).rejects.toThrow(
      "font fetch failed",
    );
    expect(await env.BUCKET.get(certPngKey(id, ev.updatedAt))).toBeNull();
  });

  it("builds the key from the attendee id and event version", () => {
    expect(certPngKey("abc", new Date(1234))).toBe("certs/abc/1234.png");
  });
});

describe("etagMatches", () => {
  const etag = '"certs/a/1.png"';
  it("matches exact, weak, list and wildcard forms", () => {
    expect(etagMatches(etag, etag)).toBe(true);
    expect(etagMatches(`W/${etag}`, etag)).toBe(true);
    expect(etagMatches(`"other", W/${etag} , "x"`, etag)).toBe(true);
    expect(etagMatches("*", etag)).toBe(true);
  });
  it("rejects null, empty and different tags", () => {
    expect(etagMatches(null, etag)).toBe(false);
    expect(etagMatches("", etag)).toBe(false);
    expect(etagMatches('"certs/a/2.png"', etag)).toBe(false);
  });
});
