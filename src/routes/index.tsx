import { createFileRoute } from "@tanstack/react-router";

import { FindEventDialog } from "@/components/find-event-dialog";
import RetroGrid from "@/components/magicui/retro-grid";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="container flex h-full min-h-screen flex-col items-center gap-6 pt-36 md:gap-8">
      <div className="flex flex-col items-center gap-2 border-b border-muted/60 pb-6 md:pb-8">
        <h1 className="bg-zinc-800 bg-clip-text text-center text-[10vw] leading-none font-extrabold tracking-tighter text-transparent md:text-7xl dark:bg-linear-to-b dark:from-foreground dark:to-zinc-400">
          Effortlessly create and email holographic badges for your events
        </h1>
      </div>

      <p className="max-w-2xl text-center text-muted-foreground md:text-xl">
        Whether it&apos;s a workshop, seminar, conference, or any other gathering,{" "}
        <span className="font-medium text-foreground">Certi</span> streamlines the process, saving
        you time and effort.
      </p>

      <FindEventDialog />
      {/* Task 4: mount the demo badge here. */}
      <RetroGrid className="absolute -bottom-64 -z-10 [mask-image:radial-gradient(ellipse_at_bottom,white,transparent_80%)]" />
    </main>
  );
}
