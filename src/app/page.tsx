import { EventButtons } from "@/components/event-buttons";
import AnimatedShinyText from "@/components/magicui/animated-shiny-text";
import RetroGrid from "@/components/magicui/retro-grid";
import { cn } from "@/lib/utils";
import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

export default async function Home() {
  return (
    <main className="container flex min-h-screen flex-col items-center gap-6 overflow-hidden pt-36 md:gap-8">
      <div className="flex flex-col items-center gap-2 border-b border-muted/60 pb-6 md:pb-8">
        <div
          className={cn(
            "bg-bg group rounded-full border border-black/5 text-base text-foreground transition-all ease-in hover:cursor-pointer hover:bg-slate-900 dark:border-white/5",
          )}
        >
          <AnimatedShinyText className="inline-flex items-center justify-center px-4 py-1 transition ease-out hover:text-neutral-600 hover:duration-300 hover:dark:text-neutral-400">
            <Link
              href="https://github.com/hyamero/certificate-generator"
              target="_blank"
              rel="noopener noreferrer"
            >
              ✨ Contribute to GitHub
            </Link>
            <ArrowRightIcon className="ml-1 size-3 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
          </AnimatedShinyText>
        </div>

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
      <RetroGrid className="absolute -bottom-64 -z-10 [mask-image:radial-gradient(ellipse_at_bottom,white,transparent_80%)]" />
    </main>
  );
}
