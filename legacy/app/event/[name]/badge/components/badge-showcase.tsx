"use client";

import useMediaQuery from "@/hooks/use-media-query";
import Badge3D from "./badge-3d";
import { db } from "@/config/firebase";
import { doc } from "firebase/firestore";
import type { Attendee } from "@/lib/types";
import { usePathname, useSearchParams } from "next/navigation";
import { useDocumentOnce } from "react-firebase-hooks/firestore";
import Loading from "../../loading";
import { Navbar } from "@/components/navbar";

export default function BadgeShowcase() {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const certId = searchParams.get("id");

  const [attendeeValue, attendeeLoading] = useDocumentOnce(
    doc(db, `${pathname.split("/")[2]}/data/certificates/${certId}`),
  );

  const attendee = {
    ...attendeeValue?.data(),
    id: attendeeValue?.id,
  } as Attendee;

  if (attendeeLoading) return <Loading />;

  if (!attendee.email)
    return (
      <div className="pt-40 text-center">
        <h3 className="text-6xl font-bold capitalize">Certificate not found</h3>
      </div>
    );

  return (
    <>
      {isDesktop ? (
        <div className="h-screen">
          <Navbar />
          <div className="absolute inset-0 flex h-screen flex-col items-center pt-40">
            <h1 className="bg-zinc-800 from-foreground bg-clip-text text-center text-[10vw] font-bold tracking-tighter text-transparent dark:bg-gradient-to-b dark:to-zinc-400 md:text-8xl">
              omsimos.com
            </h1>
            <p className="max-w-2xl text-center text-muted-foreground md:text-xl">
              This project is{" "}
              <span className="font-medium text-foreground">
                under heavy development.
              </span>{" "}
              Changes and updates may happen frequently as we work to improve
              its functionality and features.
            </p>
          </div>
          <Badge3D attendee={attendee} />
        </div>
      ) : (
        <div className="container">
          <div className="h-screen pt-40">
            <h1 className="bg-zinc-800 from-foreground bg-clip-text text-[12vw] font-bold tracking-tighter text-transparent dark:bg-gradient-to-b dark:to-zinc-400 md:text-8xl">
              omsimos.com
            </h1>
            <p className="max-w-2xl text-muted-foreground md:text-xl">
              Mobile version of 3D badge is{" "}
              <span className="font-medium text-foreground">
                under heavy development.
              </span>{" "}
              Changes and updates may happen frequently as we work to improve
              its functionality and features.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
