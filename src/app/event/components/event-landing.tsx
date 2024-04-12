"use client";

import { toast } from "sonner";
import { FormEvent, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/config/firebase";
import { useRouter } from "next/navigation";

export type EventDetails = {
  title: string;
  description: string;
};

type EventLandingProps = {
  eventDetails: EventDetails;
  eventName?: string;
};

export default function EventLanding({
  eventDetails,
  eventName,
}: EventLandingProps) {
  const { replace } = useRouter();
  const [email, setEmail] = useState("john@doe.com");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const q = query(
      collection(db, `${eventName}/data/certificates`),
      where("email", "==", email),
      limit(1)
    );

    try {
      const querySnapshot = await getDocs(q);
      let message = "⚠️ Certificate Not Found";
      querySnapshot.forEach((doc) => {
        if (doc.data().email) {
          replace(`/cert?event=${eventName}&id=${doc.id}`);
          message = "✅ Certificate found!";
          return;
        }
      });
      toast(message);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <main className="h-screen flex items-center pt-40 gap-10 flex-col">
      <div className="text-center">
        <h1 className="capitalize font-bold text-6xl"> {eventDetails.title}</h1>
        <p className="text-muted-foreground mt-2">{eventDetails.description}</p>
      </div>

      <form
        onSubmit={(e) => handleSubmit(e)}
        className="flex w-full max-w-sm items-center space-x-2"
      >
        <Input
          type="text"
          placeholder="Event"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit">Visit</Button>
      </form>
    </main>
  );
}
