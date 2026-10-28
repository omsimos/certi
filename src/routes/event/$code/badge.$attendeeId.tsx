import { ClientOnly, createFileRoute, notFound } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import type { BadgeCardData } from "@/lib/badge/layout";
import { formatEventDate } from "@/lib/format";
import { getBadgeFn, getOriginFn } from "@/server/fns";

const HoloBadge = lazy(() =>
  import("@/components/badge/holo-badge").then((m) => ({ default: m.HoloBadge })),
);

export const Route = createFileRoute("/event/$code/badge/$attendeeId")({
  loader: async ({ params }) => {
    const [badge, origin] = await Promise.all([
      getBadgeFn({ data: { code: params.code, attendeeId: params.attendeeId } }),
      getOriginFn(),
    ]);
    if (!badge) throw notFound();
    const { attendee, event } = badge;
    const card: BadgeCardData = {
      firstName: attendee.firstName,
      lastName: attendee.lastName,
      eventTitle: event.title,
      organizer: event.organizer,
      date: formatEventDate(event.date),
      attendeeId: attendee.id,
      badgeUrl: `${origin}/event/${event.code}/badge/${attendee.id}`,
    };
    // The version busts the logo cache whenever the event (and so its logo) changes.
    const logoUrl = event.logoKey ? `/api/logo/${event.code}?v=${event.updatedAt.getTime()}` : null;
    return { attendee, event, card, logoUrl };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { attendee, event } = loaderData;
    return {
      meta: [{ title: `${attendee.firstName} ${attendee.lastName} | ${event.title} | Certi` }],
    };
  },
  component: BadgePage,
});

const placeholder = <div className="aspect-[300/430] w-full rounded-xl bg-[#090a0c]" />;

function BadgePage() {
  const { event, card, logoUrl } = Route.useLoaderData();
  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-6 py-24">
      <h1 className="sr-only">
        {card.firstName} {card.lastName}, {event.title}
      </h1>
      <div className="w-full max-w-sm">
        <ClientOnly fallback={placeholder}>
          <Suspense fallback={placeholder}>
            <HoloBadge
              template={event.template}
              accent={event.accentColor}
              data={card}
              logoUrl={logoUrl}
            />
          </Suspense>
        </ClientOnly>
      </div>
    </main>
  );
}
