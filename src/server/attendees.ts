import { and, asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import type { DB } from "@/db";
import { attendee, event, type Attendee, type Event } from "@/db/schema";
import { effectiveEmailStatus } from "@/lib/email-status";
import {
  AttendeeEmailTakenError,
  NotFoundError,
  ScheduledEmailCancelError,
  ValidationError,
} from "@/lib/errors";
import type { AttendeeInput } from "@/lib/schemas";
import { UNKNOWN_RESEND_ID } from "@/server/email/client";
import { getOwnedEvent } from "@/server/events";

export { parseAttendeeRows } from "@/lib/attendee-rows";

// 7 bound columns (emailStatus' default is bound too) x 14 rows = 98 parameters,
// under D1's limit of 100 per statement.
const ROWS_PER_INSERT = 14;

export async function importAttendees(
  db: DB,
  ownerId: string,
  code: string,
  attendees: AttendeeInput[],
): Promise<{ inserted: number; skipped: number }> {
  const ev = await getOwnedEvent(db, ownerId, code);
  if (attendees.length === 0) return { inserted: 0, skipped: 0 };

  const statements = [];
  for (let i = 0; i < attendees.length; i += ROWS_PER_INSERT) {
    const values = attendees.slice(i, i + ROWS_PER_INSERT).map((a) => ({
      id: nanoid(10),
      eventId: ev.id,
      firstName: a.firstName,
      lastName: a.lastName,
      email: a.email,
    }));
    statements.push(
      db.insert(attendee).values(values).onConflictDoNothing().returning({ id: attendee.id }),
    );
  }

  // One batch is one D1 round trip and one implicit transaction.
  const results = await db.batch(statements as [(typeof statements)[number]]);
  const inserted = results.reduce((sum, rows) => sum + rows.length, 0);
  return { inserted, skipped: attendees.length - inserted };
}

export async function listAttendees(db: DB, ownerId: string, code: string): Promise<Attendee[]> {
  const ev = await getOwnedEvent(db, ownerId, code);
  return db
    .select()
    .from(attendee)
    .where(eq(attendee.eventId, ev.id))
    .orderBy(asc(attendee.lastName), asc(attendee.firstName), asc(attendee.id));
}

export async function deleteAttendee(
  db: DB,
  bucket: R2Bucket,
  ownerId: string,
  code: string,
  attendeeId: string,
  opts: { cancel?: (resendId: string) => Promise<void>; now?: Date } = {},
): Promise<void> {
  const ev = await getOwnedEvent(db, ownerId, code);
  // Scoped to the owned event so a mismatched (code, id) pair can't touch another event.
  const scope = and(eq(attendee.id, attendeeId), eq(attendee.eventId, ev.id));
  const [row] = await db
    .select({
      emailStatus: attendee.emailStatus,
      emailScheduledFor: attendee.emailScheduledFor,
      emailClaimedAt: attendee.emailClaimedAt,
      resendId: attendee.resendId,
      badgeImageKey: attendee.badgeImageKey,
    })
    .from(attendee)
    .where(scope)
    .limit(1);
  if (!row) throw new NotFoundError("Attendee not found");

  // Otherwise the deleted attendee still gets an email whose link 404s. A past-dated
  // one has already gone out, and Resend would refuse the cancel. An unknown id can't
  // be cancelled at all, so that email may still arrive.
  const status = effectiveEmailStatus(row, opts.now ?? new Date());
  if (status === "scheduled" && row.resendId && row.resendId !== UNKNOWN_RESEND_ID && opts.cancel) {
    try {
      await opts.cancel(row.resendId);
    } catch (err) {
      throw new ScheduledEmailCancelError("Couldn't cancel the scheduled email. Try again.", {
        cause: err,
      });
    }
  }

  const rows = await db.delete(attendee).where(scope).returning({ id: attendee.id });
  if (rows.length === 0) throw new NotFoundError("Attendee not found");
  // The row is gone either way; a leftover object is only storage, so don't fail the delete.
  if (row.badgeImageKey) await bucket.delete(row.badgeImageKey).catch(() => undefined);
}

export async function updateAttendee(
  db: DB,
  ownerId: string,
  code: string,
  attendeeId: string,
  input: AttendeeInput,
  opts: { cancel?: (resendId: string) => Promise<void>; now?: Date } = {},
): Promise<Attendee> {
  const ev = await getOwnedEvent(db, ownerId, code);
  const scope = and(eq(attendee.id, attendeeId), eq(attendee.eventId, ev.id));
  const [row] = await db.select().from(attendee).where(scope).limit(1);
  if (!row) throw new NotFoundError("Attendee not found");

  const nameChanged = input.firstName !== row.firstName || input.lastName !== row.lastName;
  const emailChanged = input.email !== row.email;
  if (!nameChanged && !emailChanged) return row;

  const changes: Partial<typeof attendee.$inferInsert> = {
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
  };

  if (emailChanged) {
    const [taken] = await db
      .select({ id: attendee.id })
      .from(attendee)
      .where(and(eq(attendee.eventId, ev.id), eq(attendee.email, input.email)))
      .limit(1);
    if (taken) throw new AttendeeEmailTakenError("Someone in this event already has that email");

    // The old address must not receive a badge that now belongs to someone else, so a
    // scheduled email is cancelled before the row changes (as in deleteAttendee).
    const status = effectiveEmailStatus(row, opts.now ?? new Date());
    if (status === "scheduled") {
      if (!row.resendId) {
        throw new ValidationError(
          "This badge is being sent right now. Try again in a few minutes.",
        );
      }
      if (row.resendId === UNKNOWN_RESEND_ID) {
        throw new ScheduledEmailCancelError(
          "This scheduled email can't be cancelled, so the address can't change until it has gone out.",
        );
      }
      try {
        await opts.cancel?.(row.resendId);
      } catch (err) {
        throw new ScheduledEmailCancelError("Couldn't cancel the scheduled email. Try again.", {
          cause: err,
        });
      }
    }
    Object.assign(changes, {
      emailStatus: "not_sent",
      emailScheduledFor: null,
      emailSentAt: null,
      emailError: null,
      emailClaimedAt: null,
      resendId: null,
    });
  }

  // Null forces the next send or refresh to re-render the image with the new name.
  if (nameChanged) changes.badgeImageVersion = null;

  const [updated] = await db.update(attendee).set(changes).where(scope).returning();
  if (!updated) throw new NotFoundError("Attendee not found");
  return updated;
}

export async function getBadge(
  db: DB,
  code: string,
  attendeeId: string,
): Promise<{ attendee: Attendee; event: Event } | null> {
  const [row] = await db
    .select({ attendee, event })
    .from(attendee)
    .innerJoin(event, eq(attendee.eventId, event.id))
    .where(and(eq(event.code, code), eq(attendee.id, attendeeId)))
    .limit(1);
  return row ?? null;
}
