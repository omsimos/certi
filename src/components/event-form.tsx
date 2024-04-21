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
  DialogTrigger,
} from "@/components/ui/dialog";

import useMediaQuery from "@/hooks/use-media-query";

export function EventForm() {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <>
        <div className="flex gap-3 [&>*]:px-10">
          <Button onClick={() => setOpen(!open)}>Find Event</Button>
          <Button variant="secondary">Setup Event</Button>
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
        <Button onClick={() => setOpen(!open)}>Find Event</Button>
        <Button variant="secondary">Setup Event</Button>
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <div className="pt-7 pb-36 max-w-sm w-full mx-auto">
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

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    router.push(`/event/${event}`);
  };
  return (
    <form
      onSubmit={(e) => handleSubmit(e)}
      className="flex w-full max-w-sm items-center gap-2 flex-col"
    >
      <Input
        type="text"
        placeholder="Event"
        value={event}
        onChange={(e) => setEvent(e.target.value)}
      />
      <div className="flex flex-col gap-2 w-full">
        <Button type="submit" className="w-full">
          Search
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
