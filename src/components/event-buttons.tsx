"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import useMediaQuery from "@/hooks/use-media-query";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Icons } from "./icons";

import {
  Drawer,
  DrawerTitle,
  DrawerHeader,
  DrawerContent,
  DrawerDescription,
} from "@/components/ui/drawer";

import {
  DialogDescription,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Dialog,
} from "@/components/ui/dialog";

export function EventButtons() {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  return (
    <>
      <div className="flex gap-3 [&>*]:px-10">
        <Button
          size="lg"
          className="text-md font-medium"
          onClick={() => setOpen(!open)}
        >
          Find Event
        </Button>
        <Button
          size="lg"
          className="text-md font-medium"
          asChild
          variant="secondary"
        >
          <Link href="/event-setup">Setup Event</Link>
        </Button>
      </div>

      {isDesktop ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Find Event</DialogTitle>
              <DialogDescription>Enter the event code</DialogDescription>
            </DialogHeader>
            <SearchEventForm />
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <div className="mx-auto w-full max-w-sm pb-20 pt-7 ">
              <DrawerHeader className="text-left">
                <DrawerTitle>Find Event</DrawerTitle>
                <DrawerDescription>Enter the event code</DrawerDescription>
              </DrawerHeader>
              <SearchEventForm />
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}

const SearchEventForm = ({}) => {
  const router = useRouter();
  const [event, setEvent] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    router.push(`/event/${event}`);
    setLoading(!loading);
  };

  return (
    <form
      onSubmit={(e) => handleSubmit(e)}
      className="flex w-full max-w-sm flex-col items-end gap-2 px-4 md:px-0"
    >
      <div className="flex w-full gap-2">
        <Input
          type="text"
          placeholder="Event"
          value={event}
          className="w-full"
          onChange={(e) => setEvent(e.target.value)}
        />
        <Button disabled={loading || !event} type="submit">
          {!loading ? <p>Search</p> : <Icons.spinner />}
        </Button>
      </div>
    </form>
  );
};
