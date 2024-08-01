import * as React from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import AnimatedShinyText from "@/components/magicui/animated-shiny-text";

export function CertDemo() {
  return (
    <Card className="[box-shadow:0_-10px_40px_-20px_#ffffff1f_inset]mx-auto mt-10 w-full max-w-lg scale-110 space-y-1 bg-background/20 backdrop-blur-sm">
      <CardHeader className="flex flex-col items-center justify-center">
        <AnimatedShinyText className="group inline-flex items-center justify-center rounded-full border border-white/5 bg-neutral-950 px-4 py-1 text-xs font-medium text-muted-foreground/30 opacity-40 transition ease-out">
          <span>Certificate of Recognition</span>
        </AnimatedShinyText>

        <div className="text-center text-muted-foreground/20">
          <p className="text-nowrap text-xl font-semibold sm:text-2xl">
            Developer of the Year
          </p>
          <p className="text-sm text-muted-foreground/20">
            is hereby presented to
          </p>
        </div>
      </CardHeader>
      <CardContent className="">
        <p className="border-b pb-2 text-center text-xl font-bold uppercase tracking-tighter text-muted-foreground/10 blur-[3px] sm:text-3xl">
          John Doe Omsimos
        </p>
      </CardContent>
      <CardFooter>
        <p className="text-center text-sm text-muted-foreground/20">
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Officiis
          iste, repellat ad odit fugit quod soluta commodi quibusdam nemo
        </p>
      </CardFooter>
    </Card>
  );
}
