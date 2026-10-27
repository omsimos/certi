import { useRouter } from "@tanstack/react-router";
import { LinkIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Attendee } from "@/db/schema";
import { hasErrorName } from "@/lib/errors";
import { deleteAttendeeFn } from "@/server/fns";

type Row = Pick<Attendee, "id" | "firstName" | "lastName" | "email">;

export function AttendeeTable({ code, attendees }: { code: string; attendees: Row[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function copyLink(attendee: Row) {
    // A plain string: the certificate route is added in a later task.
    const url = `${location.origin}/event/${code}/cert/${attendee.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Certificate link copied");
    } catch {
      toast.error("Could not copy the link");
    }
  }

  async function confirmDelete() {
    if (!pending) return;
    setDeleting(true);
    try {
      await deleteAttendeeFn({ data: { code, attendeeId: pending.id } });
      toast.success("Participant removed");
      setPending(null);
      await router.invalidate();
    } catch (err) {
      toast.error(
        hasErrorName(err, "ForbiddenError", "NotFoundError")
          ? "You can't change this event"
          : "Something went wrong. Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">
        Participants <span className="text-muted-foreground">({attendees.length})</span>
      </h2>

      {attendees.length === 0 ? (
        <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
          No participants yet. Import a spreadsheet or paste JSON above.
        </p>
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendees.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    {a.firstName} {a.lastName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{a.email}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => copyLink(a)}
                        aria-label={`Copy certificate link for ${a.firstName} ${a.lastName}`}
                      >
                        <LinkIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setPending(a)}
                        aria-label={`Delete ${a.firstName} ${a.lastName}`}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove participant?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending && `${pending.firstName} ${pending.lastName} (${pending.email})`} will no
              longer be able to open their certificate link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={confirmDelete}>
              {deleting ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
