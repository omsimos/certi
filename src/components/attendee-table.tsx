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
import type { SendRow } from "@/components/send-badges-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Attendee } from "@/db/schema";
import { isStaleVersionError, renderEmailImages } from "@/lib/badge/render-email-images";
import type { EmailEvent } from "@/lib/badge/render-email-images";
import { probeWebGPU } from "@/lib/badge/webgpu-support";
import { hasErrorName } from "@/lib/errors";
import { effectiveEmailStatus } from "@/lib/email-status";
import { describeSendSummary, formatShortDate, imageIsCurrent } from "@/lib/email-summary";
import { sendAllBadges } from "@/lib/send-badges-client";
import { deleteAttendeeFn } from "@/server/fns";

type Row = SendRow & Pick<Attendee, "email" | "emailError" | "emailSentAt">;

function StatusCell({ row, now }: { row: Row; now: Date }) {
  const status = effectiveEmailStatus(row, now);
  if (status === "failed") {
    return (
      <Tooltip>
        <TooltipTrigger render={<span className="text-destructive" />}>Failed</TooltipTrigger>
        <TooltipContent>{row.emailError ?? "Sending failed"}</TooltipContent>
      </Tooltip>
    );
  }
  if (status === "scheduled" && row.emailScheduledFor) {
    return <span>Scheduled &middot; {formatShortDate(row.emailScheduledFor)}</span>;
  }
  if (status === "sent") {
    const at = row.emailSentAt ?? row.emailScheduledFor;
    return <span>Sent{at && <> &middot; {formatShortDate(at)}</>}</span>;
  }
  return <span className="text-muted-foreground">Not sent</span>;
}

export function AttendeeTable({
  code,
  attendees,
  event,
  logoUrl,
  origin,
  now,
}: {
  code: string;
  attendees: Row[];
  event: EmailEvent;
  logoUrl: string | null;
  origin: string;
  now: Date;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resending, setResending] = useState<string | null>(null);

  async function resend(attendee: Row) {
    setResending(attendee.id);
    try {
      if (!imageIsCurrent(attendee, event.updatedAt)) {
        const result = await renderEmailImages({
          mode: (await probeWebGPU()) ? "rendered" : "simple",
          event,
          logoUrl,
          attendees: [attendee],
          origin,
        });
        const failure = result.failed[0];
        if (failure) {
          toast.error(
            isStaleVersionError(failure.error)
              ? "The event changed while rendering. Reopen Send badges."
              : "Couldn't render the badge image. Please try again.",
          );
          if (isStaleVersionError(failure.error)) await router.invalidate();
          return;
        }
      }
      const summary = await sendAllBadges(code, [attendee.id]);
      const lines = describeSendSummary(summary);
      const sentOrScheduled = summary.sentNow > 0 || summary.scheduled.length > 0;
      (sentOrScheduled ? toast.success : toast.error)(
        lines.length > 0 ? lines.join(". ") : "Nothing was sent",
      );
      await router.invalidate();
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setResending(null);
    }
  }

  async function copyLink(attendee: Row) {
    const url = `${location.origin}/event/${code}/badge/${attendee.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Badge link copied");
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
                <TableHead>Status</TableHead>
                <TableHead className="w-44 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendees.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">
                    {a.firstName} {a.lastName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{a.email}</TableCell>
                  <TableCell className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusCell row={a} now={now} />
                      {a.badgeImageVersion && !imageIsCurrent(a, event.updatedAt) && (
                        <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                          Image out of date
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => resend(a)}
                        disabled={resending !== null}
                        aria-label={`Resend badge to ${a.firstName} ${a.lastName}`}
                      >
                        {resending === a.id ? "Sending..." : "Resend"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => copyLink(a)}
                        aria-label={`Copy badge link for ${a.firstName} ${a.lastName}`}
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
              longer be able to open their badge link.
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
