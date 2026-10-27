import { env } from "cloudflare:workers";
import { count, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { describe, expect, it } from "vitest";
import { getDb } from "../src/db";
import { attendee, event } from "../src/db/schema";
import { createTestEvent, createTestUser } from "./helpers";

describe("schema", () => {
  it("rejects a duplicate attendee email within one event", async () => {
    const db = getDb(env.DB);
    const user = await createTestUser(db);
    const ev = await createTestEvent(db, user.id);
    const row = { eventId: ev.id, firstName: "A", lastName: "B", email: "a@b.co" };
    await db.insert(attendee).values({ id: nanoid(10), ...row });
    await expect(db.insert(attendee).values({ id: nanoid(10), ...row })).rejects.toThrow();
  });

  it("allows the same email in different events", async () => {
    const db = getDb(env.DB);
    const user = await createTestUser(db);
    const [e1, e2] = [await createTestEvent(db, user.id), await createTestEvent(db, user.id)];
    const row = { firstName: "A", lastName: "B", email: "a@b.co" };
    await expect(
      db.insert(attendee).values({ id: nanoid(10), eventId: e1.id, ...row }),
    ).resolves.toBeDefined();
    await expect(
      db.insert(attendee).values({ id: nanoid(10), eventId: e2.id, ...row }),
    ).resolves.toBeDefined();
  });

  it("cascades attendees when an event is deleted", async () => {
    const db = getDb(env.DB);
    const user = await createTestUser(db);
    const ev = await createTestEvent(db, user.id);
    await db.insert(attendee).values([
      { id: nanoid(10), eventId: ev.id, firstName: "A", lastName: "B", email: "a@b.co" },
      { id: nanoid(10), eventId: ev.id, firstName: "C", lastName: "D", email: "c@d.co" },
    ]);
    const total = () =>
      db
        .select({ n: count() })
        .from(attendee)
        .where(eq(attendee.eventId, ev.id))
        .then((r) => r[0].n);
    expect(await total()).toBe(2);

    await db.delete(event).where(eq(event.id, ev.id));
    expect(await total()).toBe(0);
  });
});
