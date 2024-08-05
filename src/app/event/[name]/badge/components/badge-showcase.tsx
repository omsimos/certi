"use client";

import useMediaQuery from "@/hooks/use-media-query";
import Badge3D from "./badge-3d";
import { db } from "@/config/firebase";
import { doc } from "firebase/firestore";
import type { Attendee } from "@/lib/types";
import { usePathname, useSearchParams } from "next/navigation";
import { useDocumentOnce } from "react-firebase-hooks/firestore";
import Loading from "../../loading";

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
        <Badge3D attendee={attendee} />
      ) : (
        <div>
          <h1 className="mt-40 text-center text-2xl font-semibold">Badge 2D</h1>
        </div>
      )}
    </>
  );
}
