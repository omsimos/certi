"use client";

import { type FormEvent, useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";

export function EventForm() {
  const router = useRouter();
  const [event, setEvent] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    router.push(`/event/${event}`);
  };

  return (
    <form
      onSubmit={(e) => handleSubmit(e)}
      className="flex w-full max-w-sm items-center space-x-2"
    >
      <Input
        type="text"
        placeholder="Event"
        value={event}
        onChange={(e) => setEvent(e.target.value)}
      />
      <Button type="submit">Visit</Button>
    </form>
  );
}
