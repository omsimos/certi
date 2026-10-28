import type { Attendee } from "@/db/schema";
import { effectiveEmailStatus } from "@/lib/email-status";
import type { SendSummary } from "@/server/email/send-badges";

export type EmailRow = Pick<
  Attendee,
  "emailStatus" | "emailScheduledFor" | "resendId" | "badgeImageVersion"
>;

export type EmailSummary = {
  notSent: number;
  failed: number;
  sent: number;
  scheduled: { date: string; count: number }[];
  needsImage: number;
};

export const localDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Pure and client-side: the dashboard already has every attendee row (P8).
export function summarizeEmails(
  attendees: EmailRow[],
  eventUpdatedAt: Date,
  now: Date,
): EmailSummary {
  const out: EmailSummary = { notSent: 0, failed: 0, sent: 0, scheduled: [], needsImage: 0 };
  const slots = new Map<string, number>();
  for (const a of attendees) {
    const status = effectiveEmailStatus(a, now);
    if (status === "sent") out.sent++;
    else if (status === "scheduled") {
      const key = localDateKey(a.emailScheduledFor ?? now);
      slots.set(key, (slots.get(key) ?? 0) + 1);
    } else {
      if (status === "failed") out.failed++;
      else out.notSent++;
      if (a.badgeImageVersion?.getTime() !== eventUpdatedAt.getTime()) out.needsImage++;
    }
  }
  out.scheduled = [...slots]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, count]) => ({ date, count }));
  return out;
}

export const emptySummary = (): SendSummary => ({
  sentNow: 0,
  scheduled: [],
  failed: 0,
  missingImage: 0,
  overflow: 0,
  remaining: 0,
  remainingIds: [],
});

// Sent rows are never retried, so `sentNow` adds up. Missing-image and overflow rows aren't
// touched by a call, so a later call counts them again: take the max. Failed rows differ by
// mode: a bulk call retries earlier failures (and re-counts them if they fail again), so the
// last call holds the current count; an explicit call continues with `remainingIds`, which
// excludes rows already attempted, so its failures add up.
export function mergeSummaries(
  a: SendSummary,
  b: SendSummary,
  { bulk }: { bulk: boolean },
): SendSummary {
  const slots = new Map<string, number>();
  for (const s of [...a.scheduled, ...b.scheduled]) {
    slots.set(s.at, (slots.get(s.at) ?? 0) + s.count);
  }
  return {
    sentNow: a.sentNow + b.sentNow,
    scheduled: [...slots]
      .map(([at, count]) => ({ at, count }))
      .sort((x, y) => (x.at < y.at ? -1 : 1)),
    failed: bulk ? b.failed : a.failed + b.failed,
    missingImage: Math.max(a.missingImage, b.missingImage),
    overflow: Math.max(a.overflow, b.overflow),
    remaining: b.remaining,
    remainingIds: b.remainingIds,
  };
}

export const formatShortDate = (d: Date | string) =>
  new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// "YYYY-MM-DD" keys are local dates; parse them as such, not as UTC.
const dateFromKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export function describeEmailSummary(s: EmailSummary): string {
  const parts = [`${s.sent} sent`];
  for (const slot of s.scheduled) {
    parts.push(`${slot.count} scheduled for ${formatShortDate(dateFromKey(slot.date))}`);
  }
  parts.push(`${s.notSent} not sent`);
  if (s.failed > 0) parts.push(`${s.failed} failed`);
  return parts.join(" · ");
}

export function describeSendSummary(s: SendSummary): string[] {
  const lines: string[] = [];
  if (s.sentNow > 0) lines.push(`Sent ${s.sentNow} now`);
  for (const slot of s.scheduled) {
    lines.push(`${slot.count} scheduled for ${formatShortDate(slot.at)}`);
  }
  if (s.missingImage > 0) lines.push(`${s.missingImage} skipped: no image`);
  if (s.overflow > 0) lines.push(`${s.overflow} left — send again tomorrow`);
  if (s.failed > 0) lines.push(`${s.failed} failed`);
  return lines;
}
