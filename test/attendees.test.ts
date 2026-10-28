import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { getDb } from "../src/db";
import { attendee } from "../src/db/schema";
import { ForbiddenError, NotFoundError, ScheduledEmailCancelError } from "../src/lib/errors";
import type { AttendeeInput } from "../src/lib/schemas";
import { deleteAttendee, getBadge, importAttendees, listAttendees } from "../src/server/attendees";
import { UNKNOWN_RESEND_ID } from "../src/server/email/client";
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

  it.each([14, 15, 28, 29])("imports %i rows across statement boundaries", async (n) => {
    const { a, ev } = await setup();
    const rows = Array.from({ length: n }, (_, i) => ({
      firstName: "F",
      lastName: "L",
      email: `b${i}@x.com`,
    }));
    expect(await importAttendees(db, a.id, ev.code, rows)).toEqual({ inserted: n, skipped: 0 });
    expect(await listAttendees(db, a.id, ev.code)).toHaveLength(n);
  });

  // 2000 rows = 134 insert statements in one batch, the largest import the server fn accepts.
  it("imports the 2000-row maximum in one batch", async () => {
    const { a, ev } = await setup();
    const rows = Array.from({ length: 2000 }, (_, i) => ({
      firstName: "F",
      lastName: "L",
      email: `m${i}@x.com`,
    }));
    expect(await importAttendees(db, a.id, ev.code, rows)).toEqual({
      inserted: 2000,
      skipped: 0,
    });
    expect(await listAttendees(db, a.id, ev.code)).toHaveLength(2000);
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

  async function scheduledAttendee(emailScheduledFor = new Date(Date.now() + 86_400_000)) {
    const { a, ev } = await setup();
    await importAttendees(db, a.id, ev.code, two);
    const [first] = await listAttendees(db, a.id, ev.code);
    await db
      .update(attendee)
      .set({ emailStatus: "scheduled", emailScheduledFor, resendId: "re_123" })
      .where(eq(attendee.id, first.id));
    return { a, ev, id: first.id };
  }

  it("cancels a scheduled email before deleting the attendee", async () => {
    const { a, ev, id } = await scheduledAttendee();
    const cancel = vi.fn(async () => {});
    await deleteAttendee(db, a.id, ev.code, id, { cancel });
    expect(cancel).toHaveBeenCalledWith("re_123");
    expect((await listAttendees(db, a.id, ev.code)).map((r) => r.id)).not.toContain(id);
  });

  it("keeps the attendee when the scheduled email can't be cancelled", async () => {
    const { a, ev, id } = await scheduledAttendee();
    const cancel = vi.fn(async () => {
      throw new Error("Resend is down");
    });
    const err = await deleteAttendee(db, a.id, ev.code, id, { cancel }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ScheduledEmailCancelError);
    expect((err as Error).message).toBe("Couldn't cancel the scheduled email. Try again.");
    expect((await listAttendees(db, a.id, ev.code)).map((r) => r.id)).toContain(id);
  });

  it("skips the cancel for a scheduled email whose time has passed", async () => {
    const { a, ev, id } = await scheduledAttendee(new Date(Date.now() - 60_000));
    const cancel = vi.fn(async () => {
      throw new Error("Email already sent");
    });
    await deleteAttendee(db, a.id, ev.code, id, { cancel });
    expect(cancel).not.toHaveBeenCalled();
    expect((await listAttendees(db, a.id, ev.code)).map((r) => r.id)).not.toContain(id);
  });

  it("deletes a scheduled attendee whose Resend id is unknown without cancelling", async () => {
    const { a, ev, id } = await scheduledAttendee();
    await db.update(attendee).set({ resendId: UNKNOWN_RESEND_ID }).where(eq(attendee.id, id));
    const cancel = vi.fn(async () => {
      throw new Error("Email not found");
    });
    await deleteAttendee(db, a.id, ev.code, id, { cancel });
    expect(cancel).not.toHaveBeenCalled();
    expect((await listAttendees(db, a.id, ev.code)).map((r) => r.id)).not.toContain(id);
  });

  it("does not cancel anything for an attendee without a scheduled email", async () => {
    const { a, ev } = await setup();
    await importAttendees(db, a.id, ev.code, two);
    const [first] = await listAttendees(db, a.id, ev.code);
    const cancel = vi.fn(async () => {});
    await deleteAttendee(db, a.id, ev.code, first.id, { cancel });
    expect(cancel).not.toHaveBeenCalled();
  });

  it("getBadge returns attendee and event", async () => {
    const { a, ev } = await setup();
    await importAttendees(db, a.id, ev.code, two);
    const ana = (await listAttendees(db, a.id, ev.code)).find((r) => r.email === "ana@x.com")!;
    const badge = await getBadge(db, ev.code, ana.id);
    expect(badge?.attendee.email).toBe("ana@x.com");
    expect(badge?.event.code).toBe(ev.code);
  });

  it("getBadge returns null when attendee belongs to another event", async () => {
    const { a, ev } = await setup();
    const ev2 = await createTestEvent(db, a.id);
    await importAttendees(db, a.id, ev2.code, two);
    const ana = (await listAttendees(db, a.id, ev2.code)).find((r) => r.email === "ana@x.com")!;
    expect(await getBadge(db, ev.code, ana.id)).toBeNull();
    expect(await getBadge(db, ev.code, "nope")).toBeNull();
  });
});
