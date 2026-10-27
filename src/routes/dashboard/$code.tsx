import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { z } from "zod";

import { AddParticipants } from "@/components/add-participants";
import { AttendeeTable } from "@/components/attendee-table";
import { EventForm } from "@/components/event-form";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hasErrorName } from "@/lib/errors";
import { formatEventDate } from "@/lib/format";
import { getOwnedEventFn, listAttendeesFn } from "@/server/fns";

const searchSchema = z.object({
  // `.default` keeps `tab` optional in links; `.catch` handles junk values.
  tab: z.enum(["participants", "details"]).default("participants").catch("participants"),
});

export const Route = createFileRoute("/dashboard/$code")({
  validateSearch: searchSchema,
  loader: async ({ params }) => {
    try {
      const [event, attendees] = await Promise.all([
        getOwnedEventFn({ data: { code: params.code } }),
        listAttendeesFn({ data: { code: params.code } }),
      ]);
      return { event, attendees };
    } catch (err) {
      // A missing event and someone else's event look the same to the caller.
      if (hasErrorName(err, "ForbiddenError", "NotFoundError")) throw notFound();
      throw err;
    }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.event.title ?? "Event"} | Certi` }],
  }),
  notFoundComponent: EventNotFound,
  component: ManageEvent,
});

function EventNotFound() {
  return (
    <main className="flex h-screen flex-col items-center gap-5 pt-40 text-center">
      <div>
        <h1 className="text-4xl font-bold">Event not found</h1>
        <p className="mt-2 text-muted-foreground">
          This event doesn't exist, or you don't have access to it.
        </p>
      </div>
      <Button nativeButton={false} render={<Link to="/dashboard" />}>
        Back to dashboard
      </Button>
    </main>
  );
}

function ManageEvent() {
  const { event, attendees } = Route.useLoaderData();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <main className="container flex min-h-screen flex-col gap-8 pt-36 pb-20">
      <div>
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; All events
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{event.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-mono">{event.code}</span> &middot; {formatEventDate(event.date)}
        </p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) =>
          navigate({ search: { tab: value === "details" ? "details" : "participants" } })
        }
        className="w-full"
      >
        <TabsList className="w-full max-w-md *:flex-1">
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="participants" className="mt-8 flex flex-col gap-12">
          <AddParticipants code={event.code} />
          <AttendeeTable code={event.code} attendees={attendees} />
        </TabsContent>

        <TabsContent value="details" className="mt-8 max-w-md">
          <EventForm mode="edit" event={event} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
