import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { getDb } from "../src/db";
import { EventCodeTakenError, ForbiddenError, NotFoundError } from "../src/lib/errors";
import { eventCodeSchema, type EventInput } from "../src/lib/schemas";
import {
  createEvent,
  getEventByCode,
  getOwnedEvent,
  listEventsByOwner,
  updateEvent,
} from "../src/server/events";
import { createTestUser } from "./helpers";

const db = getDb(env.DB);

let n = 0;
function makeInput(overrides: Partial<EventInput> = {}): EventInput {
  n += 1;
  return {
    code: `devfest-${Date.now().toString(36)}-${n}`,
    title: "DevFest 2026",
    description: "A community event with talks and workshops for developers.",
    organizer: "GDG Cloud",
    date: "2026-11-01",
    ...overrides,
  };
}

const update = {
  title: "DevFest Renamed",
  description: "A different description that is long enough to be valid.",
  organizer: "GDG Cloud",
  date: "2026-11-02",
};

describe("events", () => {
  it("creates an event owned by the user", async () => {
    const a = await createTestUser(db);
    const input = makeInput();
    const created = await createEvent(db, a.id, input);
    expect(created.code).toBe(input.code);
    expect(created.ownerId).toBe(a.id);
    expect(await getEventByCode(db, input.code)).toEqual(created);
  });

  it("lets other constraint errors propagate unchanged", async () => {
    // Unknown owner violates the foreign key, not the event.code unique index.
    const err = await createEvent(db, "no-such-user", makeInput()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(EventCodeTakenError);
  });

  it("returns null for an unknown code", async () => {
    expect(await getEventByCode(db, "nope-123")).toBeNull();
  });

  it("rejects a taken code", async () => {
    const [a, b] = [await createTestUser(db), await createTestUser(db)];
    const input = makeInput();
    await createEvent(db, a.id, input);
    await expect(createEvent(db, b.id, input)).rejects.toBeInstanceOf(EventCodeTakenError);
  });

  it("lets the owner update and bumps updatedAt", async () => {
    const a = await createTestUser(db);
    const ev = await createEvent(db, a.id, makeInput());
    const updated = await updateEvent(db, a.id, ev.code, update);
    expect(updated.title).toBe(update.title);
    expect(updated.code).toBe(ev.code);
    expect(updated.updatedAt.getTime()).toBeGreaterThan(ev.updatedAt.getTime());
    const again = await updateEvent(db, a.id, ev.code, update);
    expect(again.updatedAt.getTime()).toBeGreaterThan(updated.updatedAt.getTime());
  });

  it("forbids non-owners from updating", async () => {
    const [a, b] = [await createTestUser(db), await createTestUser(db)];
    const ev = await createEvent(db, a.id, makeInput());
    await expect(updateEvent(db, b.id, ev.code, update)).rejects.toBeInstanceOf(ForbiddenError);
    expect((await getEventByCode(db, ev.code))?.title).toBe(ev.title);
  });

  it("throws NotFoundError for an unknown code", async () => {
    const a = await createTestUser(db);
    await expect(updateEvent(db, a.id, "nope-123", update)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getOwnedEvent(db, a.id, "nope-123")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("getOwnedEvent returns for the owner and forbids others", async () => {
    const [a, b] = [await createTestUser(db), await createTestUser(db)];
    const ev = await createEvent(db, a.id, makeInput());
    expect(await getOwnedEvent(db, a.id, ev.code)).toEqual(ev);
    await expect(getOwnedEvent(db, b.id, ev.code)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lists only the owner's events, newest first", async () => {
    const [a, b] = [await createTestUser(db), await createTestUser(db)];
    const first = await createEvent(db, a.id, makeInput());
    await createEvent(db, b.id, makeInput());
    // workerd freezes the clock between I/O, so force distinct createdAt values.
    await new Promise((r) => setTimeout(r, 5));
    const second = await createEvent(db, a.id, makeInput());
    const list = await listEventsByOwner(db, a.id);
    expect(list.map((e) => e.id)).toEqual([second.id, first.id]);
  });

  it("schema rejects codes with spaces or uppercase", () => {
    expect(eventCodeSchema.safeParse("My Event").success).toBe(false);
    expect(eventCodeSchema.safeParse("MyEvent").success).toBe(false);
    expect(eventCodeSchema.safeParse("ab").success).toBe(false);
    expect(eventCodeSchema.safeParse("devfest-24").success).toBe(true);
  });
});
