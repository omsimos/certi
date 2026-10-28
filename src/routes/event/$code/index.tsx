import { createFileRoute, notFound } from "@tanstack/react-router";

import { eventCodeSchema } from "@/lib/schemas";
import { formatEventDate } from "@/lib/format";
import { getEventFn } from "@/server/fns";

export const Route = createFileRoute("/event/$code/")({
  loader: async ({ params }) => {
    // getEventFn's validator throws on a malformed code; that is simply "not found" here.
    if (!eventCodeSchema.safeParse(params.code).success) throw notFound();
    const event = await getEventFn({ data: { code: params.code } });
    if (!event) throw notFound();
    return { event };
  },
  head: ({ loaderData }) => {
    const event = loaderData?.event;
    if (!event) return {};
    return {
      meta: [
        { title: `${event.title} | Certi` },
        { name: "description", content: event.description },
        { property: "og:title", content: event.title },
        { property: "og:description", content: event.description },
      ],
    };
  },
  component: EventLanding,
});

function EventLanding() {
  const { event } = Route.useLoaderData();

  return (
    <main className="container flex flex-col gap-10 pt-36 pb-20 lg:pt-56">
      <div className="space-y-4">
        <h1 className="bg-zinc-800 from-foreground bg-clip-text text-left text-[10vw] leading-none font-extrabold tracking-tighter text-transparent md:text-7xl dark:bg-linear-to-b dark:to-zinc-400">
          {event.title}
        </h1>
        <p className="text-lg text-muted-foreground md:text-xl">
          {event.organizer} &middot; {formatEventDate(event.date)}
        </p>
      </div>

      <div>
        <h2 className="bg-zinc-800 from-foreground bg-clip-text text-left text-xl leading-none font-extrabold tracking-tighter text-transparent md:text-3xl dark:bg-linear-to-b dark:to-zinc-400">
          About the Event
        </h2>
        <p className="mt-3 w-full text-lg break-words hyphens-auto text-muted-foreground md:w-3/4 md:text-xl">
          {event.description}
        </p>
      </div>

      <p className="text-muted-foreground">Badges are emailed to attendees.</p>
    </main>
  );
}
