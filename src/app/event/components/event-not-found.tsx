import { EventForm } from "@/components/event-form";

export default function Home() {
  return (
    <main className="container flex flex-col pt-52 items-center gap-5 min-h-screen">
      <div className="text-center">
        <h1 className="font-bold xl:text-5xl 2xl:text-6xl mx-auto text-4xl whitespace-nowrap">
          Event not found
        </h1>
        <p className="w-full md:text-xl text-muted-foreground mx-auto">
          Please enter a valid event code.
        </p>
      </div>
      <EventForm />
    </main>
  );
}
