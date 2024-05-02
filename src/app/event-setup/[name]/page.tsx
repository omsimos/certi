import { db } from "@/config/firebase";
import type { Event } from "@/lib/types";
import { doc, getDoc } from "firebase/firestore";
import EventSetupTabs from "../components/event-setup-tabs";
import EventNotFound from "@/app/event/components/event-not-found";

export default async function Event({ params }: { params: { name: string } }) {
  const docRef = doc(db, params.name, "data");
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return <EventNotFound />;

  const event = { ...docSnap?.data() } as Event;

  return (
    <main className="container flex min-h-screen flex-col gap-5 pb-20 pt-36 sm:items-center">
      <EventSetupTabs event={event} />
    </main>
  );
}
