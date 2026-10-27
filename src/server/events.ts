import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import type { DB } from "@/db";
import { event, type Event } from "@/db/schema";
import { EventCodeTakenError, ForbiddenError, NotFoundError } from "@/lib/errors";
import type { EventInput, EventUpdate } from "@/lib/schemas";

// Drizzle wraps the D1 error, so the SQLite message may sit on `cause`.
function isEventCodeConflict(err: unknown): boolean {
  for (let e = err, depth = 0; e instanceof Error && depth < 5; e = e.cause, depth++) {
    if (e.message.includes("UNIQUE constraint failed: event.code")) return true;
  }
  return false;
}

export async function createEvent(db: DB, ownerId: string, input: EventInput): Promise<Event> {
  try {
    const [row] = await db
      .insert(event)
      .values({ id: nanoid(), ownerId, ...input })
      .returning();
    return row;
  } catch (err) {
    if (isEventCodeConflict(err)) throw new EventCodeTakenError("Event code is already taken");
    throw err;
  }
}

export async function getEventByCode(db: DB, code: string): Promise<Event | null> {
  const [row] = await db.select().from(event).where(eq(event.code, code)).limit(1);
  return row ?? null;
}

export async function getOwnedEvent(db: DB, ownerId: string, code: string): Promise<Event> {
  const row = await getEventByCode(db, code);
  if (!row) throw new NotFoundError("Event not found");
  if (row.ownerId !== ownerId) throw new ForbiddenError("You do not own this event");
  return row;
}

export async function updateEvent(
  db: DB,
  ownerId: string,
  code: string,
  input: EventUpdate,
): Promise<Event> {
  const prev = await getOwnedEvent(db, ownerId, code);
  // workerd freezes the clock between I/O, so a plain `new Date()` can equal the
  // previous value. The certificate cache is keyed on updatedAt, so it must strictly grow.
  const updatedAt = new Date(Math.max(Date.now(), prev.updatedAt.getTime() + 1));
  const [row] = await db
    .update(event)
    .set({ ...input, updatedAt })
    .where(eq(event.id, prev.id))
    .returning();
  return row;
}

export async function listEventsByOwner(db: DB, ownerId: string): Promise<Event[]> {
  return db.select().from(event).where(eq(event.ownerId, ownerId)).orderBy(desc(event.createdAt));
}
