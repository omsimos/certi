import type { EmailStatus } from "@/db/schema";

// A claim this old never recorded its result (the request died), so it may be retried.
export const CLAIM_TIMEOUT_MS = 10 * 60_000;

export type EmailStatusRow = {
  emailStatus: EmailStatus;
  emailScheduledFor: Date | null;
  emailClaimedAt: Date | null;
  resendId: string | null;
};

// A claim is `scheduled` with no Resend id until its send is recorded.
export const isStaleClaim = (row: EmailStatusRow, now: Date) =>
  row.emailStatus === "scheduled" &&
  !row.resendId &&
  (!row.emailClaimedAt || row.emailClaimedAt.getTime() < now.getTime() - CLAIM_TIMEOUT_MS);

// Resend sends a scheduled email at its time without telling us, so a past-dated
// `scheduled` row with a Resend id has been sent (and can no longer be cancelled).
// A stale claim never reached Resend and the next send retries it, so it reads as not sent.
export function effectiveEmailStatus(row: EmailStatusRow, now: Date): EmailStatus {
  if (isStaleClaim(row, now)) return "not_sent";
  if (
    row.emailStatus === "scheduled" &&
    row.resendId &&
    row.emailScheduledFor &&
    row.emailScheduledFor.getTime() <= now.getTime()
  ) {
    return "sent";
  }
  return row.emailStatus;
}
