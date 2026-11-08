import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import type { DB } from "@/db";
import { attendee, event, type Event } from "@/db/schema";
import { effectiveEmailStatus } from "@/lib/email-status";
import {
  EventCodeTakenError,
  EventHasScheduledEmailsError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import type { EventInput, EventUpdate } from "@/lib/schemas";

// Drizzle wraps the D1 error, so the SQLite message may sit on `cause`.
function isEventCodeConflict(err: unknown): boolean {
  for (let e = err, depth = 0; e instanceof Error && depth < 5; e = e.cause, depth++) {
    if (e.message.includes("UNIQUE constraint failed: event.code")) return true;
  }
  return false;
}

export type PublicEvent = Omit<Event, "ownerId">;

// Public reads must not expose who owns an event.
export function toPublicEvent({ ownerId: _ownerId, ...rest }: Event): PublicEvent {
  return rest;
}

export async function createEvent(db: DB, ownerId: string, input: EventInput): Promise<Event> {
  try {
    const [row] = await db
      .insert(event)
      // Explicit fields so stray keys on `input` (id, ownerId, timestamps) are ignored.
      .values({
        id: nanoid(),
        ownerId,
        code: input.code,
        title: input.title,
        description: input.description,
        organizer: input.organizer,
        date: input.date,
        template: input.template,
        accentColor: input.accentColor,
      })
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

// workerd freezes the clock between I/O, so a plain `new Date()` can equal the
// previous value. updatedAt must strictly grow so caches keyed on it are invalidated.
export function nextUpdatedAt(prev: Event): Date {
  return new Date(Math.max(Date.now(), prev.updatedAt.getTime() + 1));
}

export async function updateEvent(
  db: DB,
  ownerId: string,
  code: string,
  input: EventUpdate,
): Promise<Event> {
  const prev = await getOwnedEvent(db, ownerId, code);
  const updatedAt = nextUpdatedAt(prev);
  const [row] = await db
    .update(event)
    .set({
      title: input.title,
      description: input.description,
      organizer: input.organizer,
      date: input.date,
      template: input.template,
      accentColor: input.accentColor,
      updatedAt,
    })
    .where(and(eq(event.id, prev.id), eq(event.ownerId, ownerId)))
    .returning();
  return row;
}

export async function listEventsByOwner(db: DB, ownerId: string): Promise<Event[]> {
  return db.select().from(event).where(eq(event.ownerId, ownerId)).orderBy(desc(event.createdAt));
}

const R2_DELETE_BATCH = 1000;

export async function deleteEvent(
  db: DB,
  bucket: R2Bucket,
  ownerId: string,
  code: string,
  opts: { now?: Date } = {},
): Promise<void> {
  const now = opts.now ?? new Date();
  const ev = await getOwnedEvent(db, ownerId, code);
  const rows = await db
    .select({
      emailStatus: attendee.emailStatus,
      emailScheduledFor: attendee.emailScheduledFor,
      emailClaimedAt: attendee.emailClaimedAt,
      resendId: attendee.resendId,
      badgeImageKey: attendee.badgeImageKey,
    })
    .from(attendee)
    .where(eq(attendee.eventId, ev.id));

  // Resend would still send these and the links would 404; cancelling hundreds exceeds the subrequest limit.
  const waiting = rows.filter((r) => effectiveEmailStatus(r, now) === "scheduled").length;
  if (waiting > 0) {
    throw new EventHasScheduledEmailsError(
      `${waiting} badge ${waiting === 1 ? "email is" : "emails are"} scheduled. Delete the event after ${waiting === 1 ? "it goes" : "they go"} out, or remove those participants first.`,
    );
  }

  // Attendees go with the event via the foreign-key cascade.
  await db.delete(event).where(and(eq(event.id, ev.id), eq(event.ownerId, ownerId)));

  const keys = [ev.logoKey, ...rows.map((r) => r.badgeImageKey)].filter((k): k is string => !!k);
  // A leftover object is only storage, so a failed cleanup never fails the delete.
  for (let i = 0; i < keys.length; i += R2_DELETE_BATCH) {
    await bucket.delete(keys.slice(i, i + R2_DELETE_BATCH)).catch(() => undefined);
  }
}
