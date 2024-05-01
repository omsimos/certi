"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogTrigger,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";

import { Icons } from "./icons";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

export default function ManageEventDialog() {
  const [eventCode, setEventCode] = useState("");
  const [openModal, setOpenModal] = useState(false);
  const { push } = useRouter();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    push(`/event-setup/${eventCode}`);
    setOpenModal(false);
  };

  return (
    <Dialog open={openModal} onOpenChange={setOpenModal}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Icons.wrench className="h-[1.2rem] w-[1.2rem]" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage an event</DialogTitle>
          <DialogDescription>
            <Link
              href="/event-setup"
              className="hover:underline"
              onClick={() => setOpenModal(false)}
            >
              Create new event instead?
            </Link>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => handleSubmit(e)}>
          <div className="flex gap-3">
            <Input
              required
              type="text"
              placeholder="Enter event code"
              value={eventCode}
              onChange={(e) => setEventCode(e.target.value)}
            />
            <Button type="submit">Manage</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
