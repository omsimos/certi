"use client";

import { db } from "@/config/firebase";
import { doc } from "firebase/firestore";
import type { Attendee, Event } from "@/lib/types";
import { usePathname, useSearchParams } from "next/navigation";
import { useDocumentOnce } from "react-firebase-hooks/firestore";

import { useCopyToClipboard } from "@/hooks/copy-to-clipboard";
import { Card, CardContent } from "@/components/ui/card";
import Loading from "../[name]/cert/loading";
import Tilt from "react-parallax-tilt";
import { toPng } from "html-to-image";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Icons } from "@/components/icons";
import Link from "next/link";
import { Button } from "@/components/ui/button";

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

  const event = { ...eventValue?.data() } as Event;

  const cardRef = useRef<HTMLDivElement>(null);
  const [imgLoading, setImgLoading] = useState(false);

  const saveImage = useCallback(() => {
    if (cardRef.current === null) {
      return;
    }

    setImgLoading(true);

    toast.promise(
      toPng(cardRef.current, {
        skipAutoScale: true,
        cacheBust: true,
        pixelRatio: 3,
      })
        .then((dataUrl) => {
          const link = document.createElement("a");
          link.download = `certificate_${certId}.png`;
          link.href = dataUrl;
          link.click();
          toast.success("Image Saved!");
          setImgLoading(false);
        })
        .catch((err) => {
          toast.error(err.message);
          setImgLoading(false);
        }),
      { loading: "Saving image...", success: "Saved image!", error: "Error!" },
    );
  }, [cardRef, certId]);

  if (attendeeLoading || eventLoading) return <Loading />;

  if (!attendee.email)
    return (
      <div className="pt-40 text-center">
        <h3 className="text-6xl font-bold capitalize">Certificate not found</h3>
      </div>
    );

  return (
    <div className="container flex h-screen flex-col items-center justify-center">
      <Tilt>
        <Card
          ref={cardRef}
          className="relative max-w-screen-sm overflow-x-hidden border-none bg-foreground text-background"
        >
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
                  <span className="font-medium">{event.title}</span> by{" "}
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

      <div className="mt-8 flex items-center space-x-2 sm:space-x-4">
        {imgLoading ? (
          <Icons.spinner className="h-6 w-6 text-white" />
        ) : (
          <>
            <Link href={`/event/${pathname.split("/")[2]}`}>
              <Icons.arrowLeft className="h-10 w-10 " />
            </Link>

            <Button
              variant="outline"
              type="button"
              disabled={imgLoading}
              onClick={saveImage}
            >
              Download
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
