"use client";

import { type FormEvent, useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

export function EventForm() {
  const router = useRouter();
  const [event, setEvent] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    router.push(`/event/${event}`);
  };

  const [openDrawer, setOpenDrawer] = useState(false);

  return (
    <div>
      <div className="flex gap-3 [&>*]:px-10">
        <Button onClick={() => setOpenDrawer(!openDrawer)}>Find Event</Button>
        <Button variant="secondary">Setup Event</Button>
      </div>

      <Drawer open={openDrawer} onOpenChange={setOpenDrawer}>
        <DrawerContent>
          <div className="pt-7 pb-36 max-w-sm w-full mx-auto">
            <DrawerHeader className="px-0">
              <DrawerTitle>Find Event</DrawerTitle>
              <DrawerDescription>Enter event code</DrawerDescription>
            </DrawerHeader>
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
                <DrawerClose className="w-full">
                  <Button variant="outline" className="w-full">
                    Cancel
                  </Button>
                </DrawerClose>
              </div>
            </form>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
