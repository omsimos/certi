import type { EmailStatus } from "@/db/schema";

// Resend sends a scheduled email at its time without telling us, so a past-dated
// `scheduled` row with a Resend id has been sent (and can no longer be cancelled).
// Without an id it is a claim that never reached Resend, so it stays `scheduled`.
export function effectiveEmailStatus(
  row: { emailStatus: EmailStatus; emailScheduledFor: Date | null; resendId: string | null },
  now: Date,
): EmailStatus {
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
