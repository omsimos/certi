import { and, asc, eq, gt, inArray, isNotNull, ne, or } from "drizzle-orm";

import type { DB } from "@/db";
import { attendee, type Event } from "@/db/schema";
import { renderBadgeEmail } from "@/server/email/badge-email";
import type { EmailClient, OutgoingEmail, SendResult } from "@/server/email/client";
import { DAY_MS, planSendSlots } from "@/server/email/slots";
import { getOwnedEvent } from "@/server/events";

// Workers Free allows 50 external subrequests per request; this leaves headroom.
export const MAX_RESEND_CALLS_PER_REQUEST = 20;
// Resend's batch endpoint takes at most 100 emails.
export const BATCH_SIZE = 100;
// 90 ids + the SET and status params stay under D1's 100 bound parameters per statement.
const IDS_PER_STATEMENT = 90;

export type SendDeps = {
  db: DB;
  client: EmailClient;
  now: Date;
  dailyLimit: number;
  origin: string;
  from: string;
};

export type SendSummary = {
  sentNow: number;
  scheduled: { at: string; count: number }[];
  failed: number;
  missingImage: number;
  overflow: number;
};

type Candidate = {
  id: string;
  firstName: string;
  email: string;
  emailStatus: string;
  resendId: string | null;
  badgeImageKey: string | null;
  badgeImageVersion: Date | null;
};

type Batch = { slot: number; at: Date; rows: Candidate[] };

const candidateColumns = {
  id: attendee.id,
  firstName: attendee.firstName,
  email: attendee.email,
  emailStatus: attendee.emailStatus,
  resendId: attendee.resendId,
  badgeImageKey: attendee.badgeImageKey,
  badgeImageVersion: attendee.badgeImageVersion,
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// A claimed row is `scheduled` with no resendId until its send is recorded.
const isInFlight = (r: Candidate) => r.emailStatus === "scheduled" && !r.resendId;
const needsCancel = (r: Candidate, explicit: boolean) =>
  explicit && r.emailStatus === "scheduled" && !!r.resendId;

async function loadCandidates(db: DB, ev: Event, attendeeIds?: string[]): Promise<Candidate[]> {
  const order = [asc(attendee.createdAt), asc(attendee.id)];
  if (!attendeeIds) {
    return db
      .select(candidateColumns)
      .from(attendee)
      .where(
        and(eq(attendee.eventId, ev.id), inArray(attendee.emailStatus, ["not_sent", "failed"])),
      )
      .orderBy(...order);
  }
  // Filtered in memory: up to 2000 ids would blow D1's bound-parameter limit.
  const wanted = new Set(attendeeIds);
  const rows = await db
    .select(candidateColumns)
    .from(attendee)
    .where(eq(attendee.eventId, ev.id))
    .orderBy(...order);
  return rows.filter((r) => wanted.has(r.id) && !isInFlight(r));
}

// The quota is per Resend account, so every event's sends and schedules count.
async function loadCommitments(db: DB, now: Date): Promise<Date[]> {
  const since = new Date(now.getTime() - DAY_MS);
  const rows = await db
    .select({
      status: attendee.emailStatus,
      sentAt: attendee.emailSentAt,
      scheduledFor: attendee.emailScheduledFor,
    })
    .from(attendee)
    .where(
      or(
        and(eq(attendee.emailStatus, "sent"), gt(attendee.emailSentAt, since)),
        and(eq(attendee.emailStatus, "scheduled"), gt(attendee.emailScheduledFor, since)),
      ),
    );
  return rows.map((r) => (r.status === "sent" ? r.sentAt! : r.scheduledFor!));
}

// The conditional UPDATE is what stops a double click or a second tab from emailing
// anyone twice: only the request whose UPDATE flips the row gets it back.
async function claim(db: DB, ids: string[], at: Date, explicit: boolean): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const allowed = explicit
    ? or(ne(attendee.emailStatus, "scheduled"), isNotNull(attendee.resendId))
    : inArray(attendee.emailStatus, ["not_sent", "failed"]);
  const statements = chunk(ids, IDS_PER_STATEMENT).map((part) =>
    db
      .update(attendee)
      .set({ emailStatus: "scheduled", emailScheduledFor: at, resendId: null, emailError: null })
      .where(and(inArray(attendee.id, part), allowed))
      .returning({ id: attendee.id }),
  );
  const results = await db.batch(statements as [(typeof statements)[number]]);
  return new Set(results.flat().map((r) => r.id));
}

// Keeps the longest prefix whose Resend calls (one batch + one cancel per scheduled
// resend) fit the remaining budget.
function affordablePrefix(rows: Candidate[], budget: number, explicit: boolean): Candidate[] {
  let cost = 1;
  let n = 0;
  for (const r of rows) {
    const next = cost + (needsCancel(r, explicit) ? 1 : 0);
    if (next > budget) break;
    cost = next;
    n++;
  }
  return cost > budget ? [] : rows.slice(0, n);
}

async function sendSafely(
  client: EmailClient,
  emails: OutgoingEmail[],
  key: string,
): Promise<SendResult[]> {
  try {
    const results = await client.sendBatch(emails, key);
    return emails.map((_, i) => results[i] ?? { ok: false, error: "No result from email client" });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return emails.map(() => ({ ok: false, error }));
  }
}

export async function sendBadges(
  deps: SendDeps,
  ownerId: string,
  code: string,
  opts: { attendeeIds?: string[] } = {},
): Promise<SendSummary> {
  const { db, client, now } = deps;
  const ev = await getOwnedEvent(db, ownerId, code);
  const explicit = opts.attendeeIds !== undefined;

  const candidates = await loadCandidates(db, ev, opts.attendeeIds);
  // An image rendered before the last event edit shows stale details.
  const ready = candidates.filter(
    (r) => r.badgeImageKey && r.badgeImageVersion?.getTime() === ev.updatedAt.getTime(),
  );

  const maxPlanned = MAX_RESEND_CALLS_PER_REQUEST * BATCH_SIZE;
  const count = Math.min(ready.length, maxPlanned);
  const plan = planSendSlots({
    count,
    now,
    dailyLimit: deps.dailyLimit,
    commitments: await loadCommitments(db, now),
  });

  const summary: SendSummary = {
    sentNow: 0,
    scheduled: [],
    failed: 0,
    missingImage: candidates.length - ready.length,
    overflow: ready.length - count + plan.overflow,
  };

  const batches: Batch[] = [];
  let offset = 0;
  plan.slots.forEach((slot, i) => {
    const rows = ready.slice(offset, (offset += slot.size));
    for (const part of chunk(rows, BATCH_SIZE)) batches.push({ slot: i, at: slot.at, rows: part });
  });

  const scheduledPerSlot = new Map<number, number>();
  let budget = MAX_RESEND_CALLS_PER_REQUEST;
  let stopped = false;

  for (const batch of batches) {
    const rows = stopped ? [] : affordablePrefix(batch.rows, budget, explicit);
    summary.overflow += batch.rows.length - rows.length;
    if (rows.length === 0) {
      stopped = true;
      continue;
    }

    const toClaim: Candidate[] = [];
    for (const r of rows) {
      if (!needsCancel(r, explicit)) {
        toClaim.push(r);
        continue;
      }
      budget--;
      try {
        await client.cancel(r.resendId!);
        toClaim.push(r);
      } catch {
        // The old email may still go out, so sending another would double up.
        summary.failed++;
      }
    }

    const claimedIds = await claim(
      db,
      toClaim.map((r) => r.id),
      batch.at,
      explicit,
    );
    const claimed = toClaim.filter((r) => claimedIds.has(r.id));
    if (claimed.length === 0) continue;

    // Today may be full, so the first planned slot can already be a later day.
    const later = batch.at.getTime() !== now.getTime();
    const emails = claimed.map((r): OutgoingEmail => {
      const content = renderBadgeEmail({
        firstName: r.firstName,
        eventTitle: ev.title,
        organizer: ev.organizer,
        badgeUrl: `${deps.origin}/event/${ev.code}/badge/${r.id}`,
        imageUrl: `${deps.origin}/api/badge/${ev.code}/${r.id}?v=${r.badgeImageVersion!.getTime()}`,
      });
      return {
        from: deps.from,
        to: r.email,
        ...content,
        ...(later ? { scheduledAt: batch.at.toISOString() } : {}),
      };
    });
    const ids = claimed.map((r) => r.id);
    const key = await sha256Hex(`${ev.id}|${batch.at.getTime()}|${ids.join(",")}`);
    budget--;
    const results = await sendSafely(client, emails, key);

    // P5: if Resend won't schedule, send only today's share and leave the rest unsent.
    if (later && results.every((r) => !r.ok && r.error.includes("scheduled_at"))) {
      const revert = chunk(ids, IDS_PER_STATEMENT).map((part) =>
        db
          .update(attendee)
          .set({ emailStatus: "not_sent", emailScheduledFor: null })
          .where(inArray(attendee.id, part)),
      );
      await db.batch(revert as [(typeof revert)[number]]);
      summary.overflow += ids.length;
      stopped = true;
      continue;
    }

    const updates = claimed.map((r, i) => {
      const result = results[i];
      const where = eq(attendee.id, r.id);
      if (!result.ok) {
        summary.failed++;
        return db
          .update(attendee)
          .set({
            emailStatus: "failed",
            emailError: result.error.slice(0, 500),
            emailScheduledFor: null,
          })
          .where(where);
      }
      if (!later) {
        summary.sentNow++;
        return db
          .update(attendee)
          .set({
            emailStatus: "sent",
            emailSentAt: now,
            emailScheduledFor: null,
            resendId: result.id,
          })
          .where(where);
      }
      scheduledPerSlot.set(batch.slot, (scheduledPerSlot.get(batch.slot) ?? 0) + 1);
      return db.update(attendee).set({ resendId: result.id }).where(where);
    });
    await db.batch(updates as [(typeof updates)[number]]);
  }

  summary.scheduled = [...scheduledPerSlot].map(([slot, n]) => ({
    at: plan.slots[slot].at.toISOString(),
    count: n,
  }));
  return summary;
}
