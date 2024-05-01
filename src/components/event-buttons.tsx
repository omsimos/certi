"use client";

import { type FormEvent, useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import useMediaQuery from "@/hooks/use-media-query";
import { Icons } from "./icons";
import Link from "next/link";

export function EventButtons() {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const router = useRouter();

  if (isDesktop) {
    return (
      <>
        <div className="flex gap-3 [&>*]:px-10">
          <Button onClick={() => setOpen(!open)}>Find Event</Button>
          <Button variant="secondary">
            <Link href="/event-setup">Setup Event</Link>
          </Button>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Find Event</DialogTitle>
              <DialogDescription>Enter the event code</DialogDescription>
            </DialogHeader>
            <SearchEventForm openState={open} setOpenState={setOpen} />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="flex gap-3 [&>*]:px-10">
        <Button onClick={() => setOpen(true)}>Find Event</Button>
        <Button variant="secondary">
          <Link href="/event-setup">Setup Event</Link>
        </Button>
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-sm pb-36 pt-7">
            <DrawerHeader className="px-0">
              <DrawerTitle>Find Event</DrawerTitle>
              <DrawerDescription>Enter the event code</DrawerDescription>
            </DrawerHeader>
            <SearchEventForm openState={open} setOpenState={setOpen} />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

const SearchEventForm = ({
  openState,
  setOpenState,
}: {
  openState: boolean;
  setOpenState: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
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
      className="flex w-full max-w-sm flex-col items-end gap-2"
    >
      <Input
        type="text"
        placeholder="Event"
        value={event}
        onChange={(e) => setEvent(e.target.value)}
      />
      <div className="flex w-full flex-col gap-2 sm:flex-row-reverse sm:justify-end">
        <Button disabled={loading || !event} type="submit" className="w-full">
          {!loading ? <p>Search</p> : <Icons.spinner />}
        </Button>
        <Button
          variant="outline"
          onClick={(e) => {
            e.preventDefault();
            setOpenState(!openState);
          }}
          className="w-full"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
};
