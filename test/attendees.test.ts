import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { getDb } from "../src/db";
import { ForbiddenError, NotFoundError } from "../src/lib/errors";
import type { AttendeeInput } from "../src/lib/schemas";
import {
  deleteAttendee,
  findAttendeeByEmail,
  getCertificate,
  importAttendees,
  listAttendees,
} from "../src/server/attendees";
import { createTestEvent, createTestUser } from "./helpers";

const db = getDb(env.DB);

const two: AttendeeInput[] = [
  { firstName: "Ana", lastName: "Cruz", email: "ana@x.com" },
  { firstName: "Ben", lastName: "Abad", email: "ben@x.com" },
];

async function setup() {
  const a = await createTestUser(db);
  const b = await createTestUser(db);
  const ev = await createTestEvent(db, a.id);
  return { a, b, ev };
}

describe("attendees", () => {
  it("imports and reports counts", async () => {
    const { a, ev } = await setup();
    expect(await importAttendees(db, a.id, ev.code, two)).toEqual({ inserted: 2, skipped: 0 });
  });

  it("skips existing emails on re-import", async () => {
    const { a, ev } = await setup();
    await importAttendees(db, a.id, ev.code, two);
    expect(await importAttendees(db, a.id, ev.code, two)).toEqual({ inserted: 0, skipped: 2 });
  });

  it("returns zero counts for empty input", async () => {
    const { a, ev } = await setup();
    expect(await importAttendees(db, a.id, ev.code, [])).toEqual({ inserted: 0, skipped: 0 });
  });

  it("imports 500 rows (chunking)", async () => {
    const { a, ev } = await setup();
    const rows = Array.from({ length: 500 }, (_, i) => ({
      firstName: "F",
      lastName: "L",
      email: `p${i}@x.com`,
    }));
    expect(await importAttendees(db, a.id, ev.code, rows)).toEqual({ inserted: 500, skipped: 0 });
    expect(await listAttendees(db, a.id, ev.code)).toHaveLength(500);
  });

  it("forbids non-owners", async () => {
    const { b, ev } = await setup();
    await expect(importAttendees(db, b.id, ev.code, two)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("lists attendees ordered by last name", async () => {
    const { a, ev } = await setup();
    await importAttendees(db, a.id, ev.code, two);
    const list = await listAttendees(db, a.id, ev.code);
    expect(list.map((x) => x.lastName)).toEqual(["Abad", "Cruz"]);
    expect(list[0].id).toHaveLength(10);
  });

  it("forbids non-owners from listing and deleting", async () => {
    const { a, b, ev } = await setup();
    await importAttendees(db, a.id, ev.code, two);
    const [first] = await listAttendees(db, a.id, ev.code);
    await expect(listAttendees(db, b.id, ev.code)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(deleteAttendee(db, b.id, ev.code, first.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("deletes an attendee and throws NotFound for unknown ids", async () => {
    const { a, ev } = await setup();
    await importAttendees(db, a.id, ev.code, two);
    const [first] = await listAttendees(db, a.id, ev.code);
    await deleteAttendee(db, a.id, ev.code, first.id);
    expect(await listAttendees(db, a.id, ev.code)).toHaveLength(1);
    await expect(deleteAttendee(db, a.id, ev.code, first.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("cannot delete an attendee of another event through an owned code", async () => {
    const { a, ev } = await setup();
    const ev2 = await createTestEvent(db, a.id);
    await importAttendees(db, a.id, ev2.code, two);
    const [other] = await listAttendees(db, a.id, ev2.code);
    await expect(deleteAttendee(db, a.id, ev.code, other.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await listAttendees(db, a.id, ev2.code)).toHaveLength(2);
  });

  it("finds attendees by email ignoring case and whitespace", async () => {
    const { a, ev } = await setup();
    await importAttendees(db, a.id, ev.code, two);
    expect(await findAttendeeByEmail(db, ev.code, "  ANA@x.com ")).toEqual({
      id: expect.any(String),
    });
  });

  it("does not find an attendee of another event", async () => {
    const { a, ev } = await setup();
    const ev2 = await createTestEvent(db, a.id);
    await importAttendees(db, a.id, ev2.code, two);
    expect(await findAttendeeByEmail(db, ev.code, "ana@x.com")).toBeNull();
    expect(await findAttendeeByEmail(db, "no-such-event", "ana@x.com")).toBeNull();
  });

  it("getCertificate returns attendee and event", async () => {
    const { a, ev } = await setup();
    await importAttendees(db, a.id, ev.code, two);
    const found = await findAttendeeByEmail(db, ev.code, "ana@x.com");
    const cert = await getCertificate(db, ev.code, found!.id);
    expect(cert?.attendee.email).toBe("ana@x.com");
    expect(cert?.event.code).toBe(ev.code);
  });

  it("getCertificate returns null when attendee belongs to another event", async () => {
    const { a, ev } = await setup();
    const ev2 = await createTestEvent(db, a.id);
    await importAttendees(db, a.id, ev2.code, two);
    const found = await findAttendeeByEmail(db, ev2.code, "ana@x.com");
    expect(await getCertificate(db, ev.code, found!.id)).toBeNull();
    expect(await getCertificate(db, ev.code, "nope")).toBeNull();
  });
});
