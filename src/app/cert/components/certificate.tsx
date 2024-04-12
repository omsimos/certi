"use client";

import { db } from "@/config/firebase";
import { doc } from "firebase/firestore";
import { useSearchParams } from "next/navigation";
import { useDocumentOnce } from "react-firebase-hooks/firestore";
import Loading from "../loading";

type Attendee = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export function Certificate() {
  const searchParams = useSearchParams();
  const certId = searchParams.get("id");
  const eventName = searchParams.get("event");

  const [value, loading] = useDocumentOnce(
    doc(db, `${eventName}/data/certificates/${certId}`)
  );

  const data = { ...value?.data(), id: value?.id } as Attendee;

  if (loading) return <Loading />;

  return (
    <div className="text-center pt-40">
      <p className="text-muted-foreground mt-2">{eventName}</p>
      <h1 className="capitalize font-bold text-6xl"> Certificate</h1>
      <p className="text-muted-foreground mt-2">{data.id}</p>
      <p className="text-muted-foreground mt-2">{data.email}</p>
    </div>
  );
}
