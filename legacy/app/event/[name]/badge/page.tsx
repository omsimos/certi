import { doc, getDoc } from "firebase/firestore";
import BadgeShowcase from "./components/badge-showcase";
import { db } from "@/config/firebase";
import EventNotFound from "../../components/event-not-found";

export default async function Badge({ params }: { params: { name: string } }) {
  const docRef = doc(db, params.name, "data");
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) return <EventNotFound />;

  return <BadgeShowcase />;
}
