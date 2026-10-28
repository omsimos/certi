import { and, asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import type { DB } from "@/db";
import { attendee, event, type Attendee, type Event } from "@/db/schema";
import { effectiveEmailStatus } from "@/lib/email-status";
import { NotFoundError, ScheduledEmailCancelError } from "@/lib/errors";
import type { AttendeeInput } from "@/lib/schemas";
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
      resendId: attendee.resendId,
    })
    .from(attendee)
    .where(scope)
    .limit(1);
  if (!row) throw new NotFoundError("Attendee not found");

  // Otherwise the deleted attendee still gets an email whose link 404s. A past-dated
  // one has already gone out, and Resend would refuse the cancel.
  const status = effectiveEmailStatus(row, opts.now ?? new Date());
  if (status === "scheduled" && row.resendId && opts.cancel) {
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
