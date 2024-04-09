"use client";

import { useSearchParams } from "next/navigation";

export default function EventLanding() {
  const searchParams = useSearchParams();
  const eventName = searchParams.get("name");

  return (
    <main className="h-screen grid place-items-center">
      <div className="text-center">
        <h1 className="capitalize font-bold text-6xl">{eventName} Event</h1>
        <p className="text-muted-foreground">Certificate Generator with CMS!</p>
      </div>
    </main>
  );
}
