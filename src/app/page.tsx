import { EventButtons } from "@/components/event-buttons";

export default function Home() {
  return (
    <main className="container flex min-h-screen flex-col gap-5 pt-52 sm:items-center">
      <div className="sm:text-center">
        <h1 className="mx-auto text-3xl font-bold md:w-4/5 md:text-4xl lg:w-3/4 xl:text-5xl 2xl:text-6xl">
          Effortlessly create and distribute e-certificates for your events
        </h1>
        <p className="mx-auto mt-3 w-full text-muted-foreground sm:w-2/3 md:text-xl">
          Whether it&apos;s a workshop, seminar, conference, or any other
          gathering, Certi streamlines the process, saving you time and effort.
        </p>
      </div>
      <EventButtons />
    </main>
  );
}
