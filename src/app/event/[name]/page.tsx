import { db } from "@/config/firebase";
import { doc, getDoc } from "firebase/firestore";
import EventLanding, { type EventDetails } from "../components/event-landing";

export default async function Event({ params }: { params: { name: string } }) {
  const docRef = doc(db, params.name, "data");
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return (
      <EventLanding
        eventDetails={docSnap.data() as EventDetails}
        eventName={params.name}
      />
    );
  } else {
    return (
      <EventLanding
        eventDetails={{ title: "404", description: "Event Not Found" }}
      />
    );
  }
}
