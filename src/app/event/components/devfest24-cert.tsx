"use client";

import { useCallback, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useDocumentOnce } from "react-firebase-hooks/firestore";
import type { Attendee, Event } from "@/lib/types";
import { doc } from "firebase/firestore";
import { db } from "@/config/firebase";

import { useCopyToClipboard } from "@/hooks/copy-to-clipboard";
import Loading from "../[name]/cert/loading";
import Tilt from "react-parallax-tilt";
import { toPng } from "html-to-image";
import Image from "next/image";

import Link from "next/link";
import { toast } from "sonner";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import certImage from "@/assets/devfest-certificate.png";

export function DevfestCertificate() {
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
      <Tilt className="overflow-hidden rounded-xl">
        <div ref={cardRef} className="relative grid place-items-center">
          <Image
            priority
            quality={100}
            placeholder="blur"
            src={certImage}
            className="pointer-events-none h-auto w-full max-w-[800px] object-contain"
            alt="sample image"
          />

          <h2
            className={`absolute left-[45%] top-1/2 z-10 -translate-y-3/4 uppercase text-[#171717] [font-size:clamp(16px,3vw,24px)]`}
          >
            {attendee.firstName} {attendee.lastName}
          </h2>
        </div>
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
