import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@tanstack/react-router";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Attendee } from "@/db/schema";
import { hasErrorName } from "@/lib/errors";
import { attendeeInputSchema, type AttendeeInput } from "@/lib/schemas";
import { updateAttendeeFn } from "@/server/fns";

export function EditParticipantDialog({
  code,
  attendee,
  open,
  onOpenChange,
}: {
  code: string;
  attendee: Pick<Attendee, "id" | "firstName" | "lastName" | "email">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const form = useForm<AttendeeInput>({
    resolver: zodResolver(attendeeInputSchema),
    defaultValues: {
      firstName: attendee.firstName,
      lastName: attendee.lastName,
      email: attendee.email,
    },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit(values: AttendeeInput) {
    try {
      await updateAttendeeFn({ data: { ...values, code, attendeeId: attendee.id } });
      toast.success("Participant updated");
      await router.invalidate();
      onOpenChange(false);
    } catch (err) {
      if (hasErrorName(err, "AttendeeEmailTakenError")) {
        form.setError("email", { message: (err as Error).message });
      } else if (hasErrorName(err, "ScheduledEmailCancelError", "ValidationError")) {
        toast.error((err as Error).message);
      } else if (hasErrorName(err, "ForbiddenError", "NotFoundError")) {
        toast.error("You can't change this event");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit participant</DialogTitle>
          <DialogDescription>
            Their badge link stays the same, so you don't need to re-import.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <Field data-invalid={!!errors.firstName}>
                  <FieldLabel htmlFor="edit-first-name">First name</FieldLabel>
                  <Input
                    {...field}
                    id="edit-first-name"
                    autoComplete="off"
                    aria-invalid={!!errors.firstName}
                  />
                  <FieldError errors={[errors.firstName]} />
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <Field data-invalid={!!errors.lastName}>
                  <FieldLabel htmlFor="edit-last-name">Last name</FieldLabel>
                  <Input
                    {...field}
                    id="edit-last-name"
                    autoComplete="off"
                    aria-invalid={!!errors.lastName}
                  />
                  <FieldError errors={[errors.lastName]} />
                </Field>
              )}
            />
          </div>
          <Controller
            control={form.control}
            name="email"
            render={({ field }) => (
              <Field data-invalid={!!errors.email}>
                <FieldLabel htmlFor="edit-email">Email</FieldLabel>
                <Input
                  {...field}
                  id="edit-email"
                  type="email"
                  autoComplete="off"
                  aria-invalid={!!errors.email}
                />
                <FieldError errors={[errors.email]} />
              </Field>
            )}
          />
          <p className="text-sm text-muted-foreground">
            Changing the email sends nothing by itself. Their status goes back to Not sent so you
            can send to the new address.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
