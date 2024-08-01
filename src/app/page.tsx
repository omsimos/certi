import { EventButtons } from "@/components/event-buttons";

export default async function Home() {
  return (
    <main className="container flex min-h-screen flex-col items-center gap-6 py-36 md:gap-8 lg:pt-64">
      <div className="border-b-2 border-dashed border-muted pb-6 md:pb-8">
        <h1 className="bg-zinc-800 from-foreground bg-clip-text text-center text-[10vw] font-extrabold leading-none tracking-tighter text-transparent dark:bg-gradient-to-b dark:to-zinc-400 md:text-7xl">
          Effortlessly create and distribute e-certificates for your events
        </h1>
      </div>

      <p className="max-w-2xl text-center text-muted-foreground md:text-xl">
        Whether it&apos;s a workshop, seminar, conference, or any other
        gathering, <span className="font-medium text-foreground">Certi</span>{" "}
        streamlines the process, saving you time and effort.{" "}
      </p>

      <EventButtons />

      {/* <Demo /> */}
    </main>
  );
}
