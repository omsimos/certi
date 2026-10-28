import { and, asc, eq, gt, inArray, isNotNull, isNull, lt, ne, or, sql } from "drizzle-orm";

import type { DB } from "@/db";
import { attendee, type EmailStatus, type Event } from "@/db/schema";
import { CLAIM_TIMEOUT_MS, effectiveEmailStatus, isStaleClaim } from "@/lib/email-status";
import { renderBadgeEmail } from "@/server/email/badge-email";
import {
  type EmailClient,
  type OutgoingEmail,
  type SendResult,
  UNKNOWN_RESEND_ID,
} from "@/server/email/client";
import { planSendSlots, SLOT_STEP_MS } from "@/server/email/slots";
import { getOwnedEvent } from "@/server/events";

// Workers Free allows 50 external subrequests per request; this leaves headroom.
export const MAX_RESEND_CALLS_PER_REQUEST = 20;
// Resend's batch endpoint takes at most 100 emails.
export const BATCH_SIZE = 100;
// Workers Free allows 10 ms of CPU per request, so one call handles one batch's worth
// and reports the rest as `remaining` for the caller to send with another call.
export const MAX_EMAILS_PER_REQUEST = 100;
// 80 ids + the SET and status params (9 today) leave headroom under D1's 100 bound
// parameters per statement for a condition added later.
const IDS_PER_STATEMENT = 80;

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
  // Not attempted: beyond the 30-day horizon, or retrying now wouldn't help.
  overflow: number;
  // Left for another call because of the per-request cap.
  remaining: number;
  // For an explicit send, the ids to pass to that call; resending all of them would
  // email the ones this call already sent again.
  remainingIds: string[];
};

type Candidate = {
  id: string;
  firstName: string;
  email: string;
  emailStatus: EmailStatus;
  emailScheduledFor: Date | null;
  emailClaimedAt: Date | null;
  resendId: string | null;
  badgeImageKey: string | null;
  badgeImageVersion: Date | null;
};

type Batch = { at: Date; rows: Candidate[] };

const candidateColumns = {
  id: attendee.id,
  firstName: attendee.firstName,
  email: attendee.email,
  emailStatus: attendee.emailStatus,
  emailScheduledFor: attendee.emailScheduledFor,
  emailClaimedAt: attendee.emailClaimedAt,
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

const claimCutoff = (now: Date) => new Date(now.getTime() - CLAIM_TIMEOUT_MS);

// While a claim is fresh another request may still be sending it, so nobody else may take it.
const isFreshClaim = (r: Candidate, now: Date) =>
  r.emailStatus === "scheduled" && !r.resendId && !isStaleClaim(r, now);

const staleClaim = (now: Date) =>
  and(
    eq(attendee.emailStatus, "scheduled"),
    isNull(attendee.resendId),
    or(isNull(attendee.emailClaimedAt), lt(attendee.emailClaimedAt, claimCutoff(now))),
  );

// Rows a bulk send picks up: never sent, failed, or a claim that died.
const bulkSendable = (now: Date) =>
  or(inArray(attendee.emailStatus, ["not_sent", "failed"]), staleClaim(now));

// An explicit resend takes any row except one another request is still sending.
const explicitSendable = (now: Date) =>
  or(
    ne(attendee.emailStatus, "scheduled"),
    isNotNull(attendee.resendId),
    isNull(attendee.emailClaimedAt),
    lt(attendee.emailClaimedAt, claimCutoff(now)),
  );

// An explicit resend of an email Resend still holds; a past-dated one has gone out.
const isPendingSchedule = (r: Candidate, explicit: boolean, now: Date) =>
  explicit && !!r.resendId && effectiveEmailStatus(r, now) === "scheduled";

const needsCancel = (r: Candidate, explicit: boolean, now: Date) =>
  isPendingSchedule(r, explicit, now) && r.resendId !== UNKNOWN_RESEND_ID;

async function loadCandidates(
  db: DB,
  ev: Event,
  now: Date,
  attendeeIds?: string[],
): Promise<Candidate[]> {
  // Failed rows go last so a run of repeated calls reaches every unsent row first.
  const order = [
    sql`${attendee.emailStatus} = 'failed'`,
    asc(attendee.createdAt),
    asc(attendee.id),
  ];
  if (!attendeeIds) {
    return db
      .select(candidateColumns)
      .from(attendee)
      .where(and(eq(attendee.eventId, ev.id), bulkSendable(now)))
      .orderBy(...order);
  }
  // Filtered in memory: up to 2000 ids would blow D1's bound-parameter limit.
  const wanted = new Set(attendeeIds);
  const rows = await db
    .select(candidateColumns)
    .from(attendee)
    .where(eq(attendee.eventId, ev.id))
    .orderBy(...order);
  return rows.filter((r) => wanted.has(r.id) && !isFreshClaim(r, now));
}

// The quota is per Resend account, so every event's sends and schedules count.
async function loadCommitments(db: DB, now: Date): Promise<Date[]> {
  // As far back as today's slot looks.
  const since = new Date(now.getTime() - SLOT_STEP_MS);
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

export function claimStatements(db: DB, ids: string[], at: Date, now: Date, explicit: boolean) {
  return chunk(ids, IDS_PER_STATEMENT).map((part) =>
    db
      .update(attendee)
      .set({
        emailStatus: "scheduled",
        emailScheduledFor: at,
        emailClaimedAt: now,
        resendId: null,
        emailError: null,
      })
      .where(and(inArray(attendee.id, part), explicit ? explicitSendable(now) : bulkSendable(now)))
      .returning({ id: attendee.id }),
  );
}

// The conditional UPDATE is what stops a double click or a second tab from emailing
// anyone twice: only the request whose UPDATE flips the row gets it back.
async function claim(
  db: DB,
  ids: string[],
  at: Date,
  now: Date,
  explicit: boolean,
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const statements = claimStatements(db, ids, at, now, explicit);
  const results = await db.batch(statements as [(typeof statements)[number]]);
  return new Set(results.flat().map((r) => r.id));
}

// Keeps the longest prefix whose Resend calls (one batch + one cancel per scheduled
// resend) fit the remaining budget.
function affordablePrefix(
  rows: Candidate[],
  budget: number,
  explicit: boolean,
  now: Date,
): Candidate[] {
  let cost = 1;
  let n = 0;
  for (const r of rows) {
    const next = cost + (needsCancel(r, explicit, now) ? 1 : 0);
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

  const candidates = await loadCandidates(db, ev, now, opts.attendeeIds);
  // An image rendered before the last event edit shows stale details.
  const ready = candidates.filter(
    (r) => r.badgeImageKey && r.badgeImageVersion?.getTime() === ev.updatedAt.getTime(),
  );

  const plan = planSendSlots({
    count: ready.length,
    now,
    dailyLimit: deps.dailyLimit,
    commitments: await loadCommitments(db, now),
  });

  const summary: SendSummary = {
    sentNow: 0,
    scheduled: [],
    failed: 0,
    missingImage: candidates.length - ready.length,
    overflow: plan.overflow,
    remaining: 0,
    remainingIds: [],
  };

  // Slot order, so this call takes the earliest rows and later calls continue from there.
  const batches: Batch[] = [];
  const deferred: Candidate[] = [];
  let offset = 0;
  let taken = 0;
  for (const slot of plan.slots) {
    const rows = ready.slice(offset, (offset += slot.size));
    const take = Math.max(0, Math.min(rows.length, MAX_EMAILS_PER_REQUEST - taken));
    taken += take;
    deferred.push(...rows.slice(take));
    for (const part of chunk(rows.slice(0, take), BATCH_SIZE)) {
      batches.push({ at: slot.at, rows: part });
    }
  }

  const scheduledPerSlot = new Map<number, number>();
  let budget = MAX_RESEND_CALLS_PER_REQUEST;
  let accepted = 0;
  let schedulingRejected = false;

  for (const batch of batches) {
    if (schedulingRejected) {
      summary.overflow += batch.rows.length;
      continue;
    }
    const rows = affordablePrefix(batch.rows, budget, explicit, now);
    deferred.push(...batch.rows.slice(rows.length));
    if (rows.length === 0) continue;

    // Today may be full, so the first planned slot can already be a later day.
    const later = batch.at.getTime() !== now.getTime();
    // Rendered before the claim, so a request killed while rendering holds no rows.
    const emails = new Map(
      rows.map((r): [string, OutgoingEmail] => [
        r.id,
        {
          from: deps.from,
          to: r.email,
          ...renderBadgeEmail({
            firstName: r.firstName,
            eventTitle: ev.title,
            organizer: ev.organizer,
            badgeUrl: `${deps.origin}/event/${ev.code}/badge/${r.id}`,
            imageUrl: `${deps.origin}/api/badge/${ev.code}/${r.id}?v=${r.badgeImageVersion!.getTime()}`,
          }),
          ...(later ? { scheduledAt: batch.at.toISOString() } : {}),
        },
      ]),
    );

    const toClaim: Candidate[] = [];
    for (const r of rows) {
      if (!isPendingSchedule(r, explicit, now)) {
        toClaim.push(r);
        continue;
      }
      if (r.resendId === UNKNOWN_RESEND_ID) {
        // It can't be cancelled and may still go out, so sending another would double up.
        summary.failed++;
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
      now,
      explicit,
    );
    const claimed = toClaim.filter((r) => claimedIds.has(r.id));
    if (claimed.length === 0) continue;

    const ids = claimed.map((r) => r.id);
    const key = await sha256Hex(`${ev.id}|${batch.at.getTime()}|${ids.join(",")}`);
    budget--;
    const results = await sendSafely(
      client,
      claimed.map((r) => emails.get(r.id)!),
      key,
    );

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
      schedulingRejected = true;
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
      accepted++;
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
      const t = batch.at.getTime();
      scheduledPerSlot.set(t, (scheduledPerSlot.get(t) ?? 0) + 1);
      return db.update(attendee).set({ resendId: result.id }).where(where);
    });
    await db.batch(updates as [(typeof updates)[number]]);
  }

  // Another call only helps if this one got something through; otherwise a caller
  // looping on `remaining` would retry the same failing rows forever.
  if (schedulingRejected || accepted === 0) {
    summary.overflow += deferred.length;
  } else {
    summary.remaining = deferred.length;
    if (explicit) summary.remainingIds = deferred.map((r) => r.id);
  }

  summary.scheduled = [...scheduledPerSlot].map(([t, count]) => ({
    at: new Date(t).toISOString(),
    count,
  }));
  return summary;
}
