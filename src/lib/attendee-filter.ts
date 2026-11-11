import type { Attendee, EmailStatus } from "@/db/schema";
import { effectiveEmailStatus } from "@/lib/email-status";
import type { EmailStatusRow } from "@/lib/email-status";
import { imageIsCurrent } from "@/lib/email-summary";

export type AttendeeFilter = "all" | EmailStatus | "outdated";

type FilterRow = EmailStatusRow &
  Pick<Attendee, "firstName" | "lastName" | "email" | "badgeImageVersion">;

export function filterAttendees<T extends FilterRow>(
  rows: T[],
  { query, status }: { query: string; status: AttendeeFilter },
  eventUpdatedAt: Date,
  now: Date,
): T[] {
  const q = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (q) {
      const name = `${row.firstName} ${row.lastName}`.toLowerCase();
      if (!name.includes(q) && !row.email.toLowerCase().includes(q)) return false;
    }
    if (status === "all") return true;
    if (status === "outdated") {
      return row.badgeImageVersion !== null && !imageIsCurrent(row, eventUpdatedAt);
    }
    return effectiveEmailStatus(row, now) === status;
  });
}
