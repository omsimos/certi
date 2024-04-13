"use client";

import { db } from "@/config/firebase";
import { doc } from "firebase/firestore";
import { usePathname, useSearchParams } from "next/navigation";
import { useDocumentOnce } from "react-firebase-hooks/firestore";
import Loading from "../[name]/cert/loading";

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

  const [value, loading] = useDocumentOnce(
    doc(db, `${pathname.split("/")[2]}/data/certificates/${certId}`)
  );

  const data = { ...value?.data(), id: value?.id } as Attendee;

  if (loading || !data) return <Loading />;

  if (!data.email)
    return (
      <div className="text-center pt-40">
        <h3 className="capitalize font-bold text-6xl">Certificate not found</h3>
      </div>
    );

  return (
    <div className="text-center pt-40">
      <p className="capitalize text-muted-foreground mt-2">
        {pathname.split("/")[2]}
      </p>
      <h1 className="capitalize font-bold text-6xl">Certificate</h1>
      <p className="text-muted-foreground mt-2">{data.id}</p>
      <p className="text-muted-foreground mt-2">{data.email}</p>
    </div>
  );
}
