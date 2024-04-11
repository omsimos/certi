"use client";

import { useSearchParams } from "next/navigation";

export function Certificate() {
  const searchParams = useSearchParams();
  const certId = searchParams.get("id");
  const eventName = searchParams.get("event");

  return (
    <div className="text-center pt-40">
      <h1 className="capitalize font-bold text-6xl"> Certificate</h1>
      <p className="text-muted-foreground mt-2">{certId}</p>
      <p className="text-muted-foreground mt-2">{eventName ?? "test"}</p>
    </div>
  );
}
