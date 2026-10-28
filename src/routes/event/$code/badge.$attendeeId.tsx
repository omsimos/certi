import { createFileRoute, notFound } from "@tanstack/react-router";

import { getBadgeFn } from "@/server/fns";

export const Route = createFileRoute("/event/$code/badge/$attendeeId")({
  loader: async ({ params }) => {
    const badge = await getBadgeFn({
      data: { code: params.code, attendeeId: params.attendeeId },
    });
    if (!badge) throw notFound();
    return badge;
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

// Placeholder until the holographic badge replaces this body.
function BadgePage() {
  const { attendee, event } = Route.useLoaderData();
  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-4xl font-bold tracking-tight break-words">
        {attendee.firstName} {attendee.lastName}
      </h1>
      <p className="text-xl text-muted-foreground">{event.title}</p>
      <p className="text-sm text-muted-foreground">Holographic badge coming soon</p>
    </main>
  );
}
