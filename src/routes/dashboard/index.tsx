import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEventDate } from "@/lib/format";
import { listMyEventsFn } from "@/server/fns";

export const Route = createFileRoute("/dashboard/")({
  head: () => ({ meta: [{ title: "Dashboard | Certi" }] }),
  loader: () => listMyEventsFn(),
  component: Dashboard,
});

function Dashboard() {
  const events = Route.useLoaderData();

  return (
    <main className="container flex min-h-screen flex-col gap-8 pt-36 pb-20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your events</h1>
          <p className="mt-1 text-muted-foreground">Manage events and their participants.</p>
        </div>
        <Button nativeButton={false} render={<Link to="/dashboard/new" />}>
          <PlusIcon />
          New event
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-20 text-center">
          <div>
            <h2 className="text-lg font-medium">No events yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first event to start issuing certificates.
            </p>
          </div>
          <Button nativeButton={false} render={<Link to="/dashboard/new" />}>
            <PlusIcon />
            New event
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                to="/dashboard/$code"
                params={{ code: event.code }}
                className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle className="truncate text-base">{event.title}</CardTitle>
                    <CardDescription className="font-mono">{event.code}</CardDescription>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarIcon className="size-3.5" aria-hidden />
                      {formatEventDate(event.date)}
                    </p>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
