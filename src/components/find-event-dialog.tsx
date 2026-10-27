import { Link, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { useMediaQuery } from "@/hooks/use-media-query";

export function FindEventDialog() {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  return (
    <>
      <div className="flex gap-3 [&>*]:px-10">
        <Button size="lg" className="text-md font-medium" onClick={() => setOpen(true)}>
          Find Event
        </Button>
        <Button
          size="lg"
          className="text-md font-medium"
          variant="secondary"
          nativeButton={false}
          render={<Link to="/dashboard/new" />}
        >
          Setup Event
        </Button>
      </div>

      {isDesktop ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Find Event</DialogTitle>
              <DialogDescription>Enter the event code</DialogDescription>
            </DialogHeader>
            <SearchEventForm onNavigate={() => setOpen(false)} />
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <div className="mx-auto w-full max-w-sm pt-7 pb-20">
              <DrawerHeader className="text-left">
                <DrawerTitle>Find Event</DrawerTitle>
                <DrawerDescription>Enter the event code</DrawerDescription>
              </DrawerHeader>
              <SearchEventForm onNavigate={() => setOpen(false)} />
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}

function SearchEventForm({ onNavigate }: { onNavigate: () => void }) {
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = code.trim().toLowerCase();
    if (!trimmed) return;
    onNavigate();
    void navigate({ to: "/event/$code", params: { code: trimmed } });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full max-w-sm flex-col items-end gap-2 px-4 md:px-0"
    >
      <div className="flex w-full gap-2">
        <Input
          type="text"
          placeholder="Event"
          value={code}
          className="w-full"
          onChange={(e) => setCode(e.target.value)}
        />
        <Button disabled={!code.trim()} type="submit">
          Search
        </Button>
      </div>
    </form>
  );
}
