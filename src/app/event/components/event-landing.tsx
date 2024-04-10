"use client";

export type EventDetails = {
  title: string;
  description: string;
};

export default function EventLanding({
  eventDetails,
}: {
  eventDetails: EventDetails;
}) {
  return (
    <main className="h-screen grid place-items-center">
      <div className="text-center">
        <h1 className="capitalize font-bold text-6xl"> {eventDetails.title}</h1>
        <p className="text-muted-foreground">{eventDetails.description}</p>
      </div>
    </main>
  );
}
