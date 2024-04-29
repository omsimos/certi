import { EventButtons } from "@/components/event-buttons";

export default function Home() {
  return (
    <main className="container flex min-h-screen flex-col items-center gap-5 pt-52">
      <div className="text-center">
        <h1 className="mx-auto whitespace-nowrap text-4xl font-bold xl:text-5xl 2xl:text-6xl">
          Event not found
        </h1>
        <p className="mx-auto w-full text-muted-foreground md:text-xl">
          Please enter a valid event code.
        </p>
      </div>
      <EventButtons />
    </main>
  );
}
