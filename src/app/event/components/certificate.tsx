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
    doc(db, `${pathname.split("/")[2]}/data/certificates/${certId}`)
  );

  const attendee = {
    ...attendeeValue?.data(),
    id: attendeeValue?.id,
  } as Attendee;

  const [eventValue, eventLoading] = useDocumentOnce(
    doc(db, `${pathname.split("/")[2]}/data`)
  );

  const event = { ...eventValue?.data(), id: eventValue?.id } as Event;

  if (attendeeLoading || eventLoading) return <Loading />;

  if (!attendee.email)
    return (
      <div className="text-center pt-40">
        <h3 className="capitalize font-bold text-6xl">Certificate not found</h3>
      </div>
    );

  return (
    <div className="h-screen grid place-items-center container">
      <Tilt>
        <Card className="relative max-w-screen-sm overflow-x-hidden border-none text-background bg-foreground">
          <div className="h-16 w-16 bg-background absolute -left-10 top-1/2 -translate-y-1/2 rounded-full hidden sm:block" />
          <div className="h-16 w-16 bg-background absolute -right-10 top-1/2 -translate-y-1/2 rounded-full" />
          <CardContent className="sm:px-16 px-0 py-0 flex flex-col sm:flex-row">
            <div className="py-10 px-10 sm:px-0 gap-12 flex flex-col">
              <h3 className="text-4xl font-bold tracking-tighter">
                {attendee.firstName} {attendee.lastName}
              </h3>
              <div>
                <p>
                  Has successfully participated in{" "}
                  <span className="font-medium">{event.fullTitle}</span> by{" "}
                  {event.organizer} held on {event.date}.
                </p>
                <p className="text-xs mt-7 text-muted-foreground">
                  Powered by <span className="font-medium">OMSIMOS</span>
                </p>
              </div>
            </div>
            <div className="border-dotted relative sm:border-l-2 sm:border-t-0 border-t-2 sm:pl-10 sm:ml-10 flex justify-center sm:text-xl text-lg py-10 sm:pb-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => copy(window.location.href.toString())}
                      className="sm:w-7 sm:[writingMode:vertical-rl] md:rotate-270 md:transform sm:text-center text-left"
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
