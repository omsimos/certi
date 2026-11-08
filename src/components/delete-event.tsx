import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hasErrorName } from "@/lib/errors";
import { deleteEventFn } from "@/server/fns";

export function DeleteEvent({ code, title }: { code: string; title: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    try {
      await deleteEventFn({ data: { code } });
      toast.success("Event deleted");
      await navigate({ to: "/dashboard" });
    } catch (err) {
      if (hasErrorName(err, "EventHasScheduledEmailsError")) {
        toast.error((err as Error).message);
      } else {
        toast.error("Something went wrong. Please try again.");
      }
      setPending(false);
    }
  }

  return (
    <section className="rounded-xl border border-destructive/30 p-4">
      <h2 className="font-medium">Delete event</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Removes the event, its participants and their badge images. Badge links stop working.
      </p>
      <Button variant="destructive" className="mt-4" onClick={() => setOpen(true)}>
        Delete event
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next);
          if (!next) setTyped("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {title}?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. Type <span className="font-mono font-medium">{code}</span> to
              confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            aria-label="Event code"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={typed !== code || pending}
              onClick={() => void confirm()}
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
