import { createFileRoute } from "@tanstack/react-router";

import { EventForm } from "@/components/event-form";

export const Route = createFileRoute("/dashboard/new")({
  head: () => ({ meta: [{ title: "New event | Certi" }] }),
  component: NewEvent,
});

function NewEvent() {
  return (
    <main className="container flex min-h-screen flex-col gap-8 pt-36 pb-20 sm:items-center">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold tracking-tight">New event</h1>
        <p className="mt-1 mb-8 text-muted-foreground">
          Set up an event, then add the participants who should receive a certificate.
        </p>
        <EventForm mode="create" />
      </div>
    </main>
  );
}
