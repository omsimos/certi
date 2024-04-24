"use client";

import { db } from "@/config/firebase";
import { doc } from "firebase/firestore";
import { usePathname, useSearchParams } from "next/navigation";
import { useDocumentOnce } from "react-firebase-hooks/firestore";

import { useCopyToClipboard } from "@/hooks/copy-to-clipboard";
import { Card, CardContent } from "@/components/ui/card";
import Loading from "../[name]/cert/loading";
import Tilt from "react-parallax-tilt";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Event = {
  id: string;
  title: string;
  fullTitle: string;
  organizer: string;
  date: string;
};

type Attendee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export function Certificate() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const certId = searchParams.get("id");

  const [_, copy] = useCopyToClipboard();

  const [attendeeValue, attendeeLoading] = useDocumentOnce(
    doc(db, `${pathname.split("/")[2]}/data/certificates/${certId}`),
  );

  const attendee = {
    ...attendeeValue?.data(),
    id: attendeeValue?.id,
  } as Attendee;

  const [eventValue, eventLoading] = useDocumentOnce(
    doc(db, `${pathname.split("/")[2]}/data`),
  );

  const event = { ...eventValue?.data(), id: eventValue?.id } as Event;

  if (attendeeLoading || eventLoading) return <Loading />;

  if (!attendee.email)
    return (
      <div className="pt-40 text-center">
        <h3 className="text-6xl font-bold capitalize">Certificate not found</h3>
      </div>
    );

  return (
    <div className="container grid h-screen place-items-center">
      <Tilt>
        <Card className="relative max-w-screen-sm overflow-x-hidden border-none bg-foreground text-background">
          <div className="absolute -left-10 top-1/2 hidden h-16 w-16 -translate-y-1/2 rounded-full bg-background sm:block" />
          <div className="absolute -right-10 top-1/2 h-16 w-16 -translate-y-1/2 rounded-full bg-background" />
          <CardContent className="flex flex-col px-0 py-0 sm:flex-row sm:px-16">
            <div className="flex flex-col gap-12 px-10 py-10 sm:px-0">
              <h3 className="text-4xl font-bold tracking-tighter">
                {attendee.firstName} {attendee.lastName}
              </h3>
              <div>
                <p>
                  Has successfully participated in{" "}
                  <span className="font-medium">{event.fullTitle}</span> by{" "}
                  {event.organizer} held on {event.date}.
                </p>
                <p className="mt-7 text-xs text-muted-foreground">
                  Powered by <span className="font-medium">OMSIMOS</span>
                </p>
              </div>
            </div>
            <div className="relative flex justify-center border-t-2 border-dotted py-10 text-lg sm:ml-10 sm:border-l-2 sm:border-t-0 sm:pb-0 sm:pl-10 sm:text-xl">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => copy(window.location.href.toString())}
                      className="md:rotate-270 text-left sm:w-7 sm:text-center sm:[writingMode:vertical-rl] md:transform"
                    >
                      {attendee.id ?? "Loading.."}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent align="center" className="relative top-14">
                    <p>Copy URL to Clipboard</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardContent>
        </Card>
      </Tilt>
    </div>
  );
}
