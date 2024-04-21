import { EventForm } from "@/components/event-form";

export default function Home() {
  return (
    <main className="container flex flex-col pt-52 sm:items-center gap-5 min-h-screen">
      <div className="sm:text-center">
        <h1 className="font-bold xl:text-5xl 2xl:text-6xl mx-auto md:text-4xl text-3xl md:w-4/5 lg:w-3/4">
          Effortlessly create and distribute e-certificates for your events
        </h1>
        <p className="sm:w-2/3 w-full md:text-xl text-muted-foreground mt-3 mx-auto">
          Whether it&apos;s a workshop, seminar, conference, or any other
          gathering, Certi streamlines the process, saving you time and effort.
        </p>
      </div>
      <EventForm />
    </main>
  );
}
