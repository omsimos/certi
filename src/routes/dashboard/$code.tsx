import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { z } from "zod";

import { AddParticipants } from "@/components/add-participants";
import { AttendeeTable } from "@/components/attendee-table";
import { EventForm } from "@/components/event-form";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { hasErrorName } from "@/lib/errors";
import { formatEventDate } from "@/lib/format";
import { describeEmailSummary, summarizeEmails } from "@/lib/email-summary";
import { getOriginFn, getOwnedEventFn, listAttendeesFn } from "@/server/fns";

const SendBadgesDialog = lazy(() =>
  import("@/components/send-badges-dialog").then((m) => ({ default: m.SendBadgesDialog })),
);

const searchSchema = z.object({
  // `.default` keeps `tab` optional in links; `.catch` handles junk values.
  tab: z.enum(["participants", "details"]).default("participants").catch("participants"),
});

export const Route = createFileRoute("/dashboard/$code")({
  validateSearch: searchSchema,
  loader: async ({ params }) => {
    try {
      const [event, attendees, origin] = await Promise.all([
        getOwnedEventFn({ data: { code: params.code } }),
        listAttendeesFn({ data: { code: params.code } }),
        getOriginFn(),
      ]);
      // Computed per load so the render stays pure and statuses refresh on invalidate.
      return { event, attendees, origin, now: new Date() };
    } catch (err) {
      // A missing event, someone else's event and a malformed code all look the same to the caller.
      if (hasErrorName(err, "ForbiddenError", "NotFoundError", "ValidationError")) throw notFound();
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
  const { event, attendees, origin, now } = Route.useLoaderData();
  const [sendOpen, setSendOpen] = useState(false);
  const summary = useMemo(
    () => summarizeEmails(attendees, event.updatedAt, now),
    [attendees, event.updatedAt, now],
  );
  const toEmail = summary.notSent + summary.failed;
  // Outdated images on scheduled emails are fixed by re-uploading them, without sending.
  const nothingToDo = toEmail === 0 && summary.staleScheduled === 0;
  const logoUrl = event.logoKey ? `/api/logo/${event.code}?v=${event.updatedAt.getTime()}` : null;
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
          <div className="flex flex-col gap-3">
            {attendees.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{describeEmailSummary(summary)}</p>
                {nothingToDo ? (
                  <Tooltip>
                    <TooltipTrigger render={<span tabIndex={0} />}>
                      <Button disabled>Send badges</Button>
                    </TooltipTrigger>
                    <TooltipContent>Everyone has been emailed</TooltipContent>
                  </Tooltip>
                ) : (
                  <Button onClick={() => setSendOpen(true)}>
                    {toEmail === 0 ? "Refresh images" : "Send badges"}
                  </Button>
                )}
              </div>
            )}
            <AttendeeTable
              code={event.code}
              attendees={attendees}
              event={event}
              logoUrl={logoUrl}
              origin={origin}
              now={now}
            />
          </div>
          {sendOpen && (
            <Suspense fallback={null}>
              <SendBadgesDialog
                open
                onOpenChange={setSendOpen}
                event={event}
                logoUrl={logoUrl}
                origin={origin}
                attendees={attendees}
                now={now}
              />
            </Suspense>
          )}
        </TabsContent>

        <TabsContent value="details" className="mt-8 max-w-md">
          <EventForm mode="edit" event={event} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
