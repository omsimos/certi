import type { BadgeCardData } from "@/lib/badge/layout";
import { formatEventDate } from "@/lib/format";

// The badge page and the emailed image both build their card here, so the two always match.
export function badgeCardData(
  event: { code: string; title: string; organizer: string; date: string },
  attendee: { id: string; firstName: string; lastName: string },
  origin: string,
): BadgeCardData {
  return {
    firstName: attendee.firstName,
    lastName: attendee.lastName,
    eventTitle: event.title,
    organizer: event.organizer,
    date: formatEventDate(event.date),
    attendeeId: attendee.id,
    badgeUrl: `${origin}/event/${event.code}/badge/${attendee.id}`,
  };
}
