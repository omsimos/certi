import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TemplatePicker, TemplatePreview, usePendingLogo } from "@/components/template-picker";
import { Textarea } from "@/components/ui/textarea";
import type { Event } from "@/db/schema";
import { hasErrorName } from "@/lib/errors";
import { DEFAULT_ACCENT } from "@/lib/badge/templates";
import { eventInputSchema, type EventInput } from "@/lib/schemas";
import { createEventFn, removeLogoFn, updateEventFn, uploadLogoFn } from "@/server/fns";

type EventFormProps =
  | { mode: "create"; event?: undefined }
  | {
      mode: "edit";
      event: Pick<
        Event,
        | "code"
        | "title"
        | "description"
        | "organizer"
        | "date"
        | "template"
        | "accentColor"
        | "logoKey"
        | "updatedAt"
      >;
    };

export function EventForm({ mode, event }: EventFormProps) {
  const navigate = useNavigate();
  const router = useRouter();
  const isEdit = mode === "edit";

  const form = useForm<z.input<typeof eventInputSchema>, unknown, EventInput>({
    resolver: zodResolver(eventInputSchema),
    defaultValues: {
      code: event?.code ?? "",
      title: event?.title ?? "",
      description: event?.description ?? "",
      organizer: event?.organizer ?? "",
      // Left empty in create mode: "today" differs between server and browser time zones.
      date: event?.date ?? "",
      template: event?.template ?? "graphite",
      accentColor: event?.accentColor ?? DEFAULT_ACCENT,
    },
  });
  const { errors, isSubmitting } = form.formState;
  const [title, organizer, date, template, accentColor] = useWatch({
    control: form.control,
    name: ["title", "organizer", "date", "template", "accentColor"],
  });

  const { pending: pendingLogo, objectUrl, setPending: setPendingLogo } = usePendingLogo();
  const savedLogoUrl = event?.logoKey
    ? // The version busts the cache whenever the logo changes.
      `/api/logo/${event.code}?v=${event.updatedAt.getTime()}`
    : null;
  const logoUrl = pendingLogo === "remove" ? null : (objectUrl ?? savedLogoUrl);

  // The event is already saved when this runs, so a failure only warns.
  async function saveLogo(code: string, values: EventInput) {
    if (pendingLogo === null || values.template !== "branded") return;
    try {
      if (pendingLogo === "remove") {
        await removeLogoFn({ data: { code } });
      } else {
        const body = new FormData();
        body.set("code", code);
        body.set("file", pendingLogo);
        await uploadLogoFn({ data: body });
      }
      setPendingLogo(null);
    } catch {
      toast.error(
        "The event was saved, but the logo couldn't be uploaded. Try again from Details.",
      );
    }
  }

  async function onSubmit(values: EventInput) {
    try {
      if (isEdit) {
        const updated = await updateEventFn({ data: values });
        form.reset({ ...values, date: updated.date });
        await saveLogo(values.code, values);
        toast.success("Event updated");
        await router.invalidate();
        return;
      }
      const created = await createEventFn({ data: values });
      await saveLogo(created.code, values);
      await navigate({ to: "/dashboard/$code", params: { code: created.code } });
    } catch (err) {
      if (hasErrorName(err, "EventCodeTakenError")) {
        form.setError("code", { message: "That event code is already taken" });
        return;
      }
      if (hasErrorName(err, "ForbiddenError", "NotFoundError")) {
        toast.error("You can't edit this event");
        return;
      }
      if (hasErrorName(err, "ValidationError")) {
        toast.error("Some fields are invalid. Check the form and try again.");
        return;
      }
      toast.error("Something went wrong. Please try again.");
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="grid gap-8 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]"
    >
      <div className="flex flex-col gap-6">
        <Controller
          control={form.control}
          name="code"
          render={({ field }) => (
            <Field data-invalid={!!errors.code}>
              <FieldLabel htmlFor="event-code">Event code</FieldLabel>
              <Input
                {...field}
                id="event-code"
                placeholder="omsimos-os"
                autoComplete="off"
                autoCapitalize="none"
                disabled={isEdit}
                aria-invalid={!!errors.code}
              />
              <FieldDescription>
                {isEdit
                  ? "The event code cannot be changed."
                  : "Lowercase letters, numbers and dashes (3-32). It appears in badge links and can't be changed later."}
              </FieldDescription>
              <FieldError errors={[errors.code]} />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="title"
          render={({ field }) => (
            <Field data-invalid={!!errors.title}>
              <FieldLabel htmlFor="event-title">Title</FieldLabel>
              <Input
                {...field}
                id="event-title"
                placeholder="Omsimos: The Collective OS"
                aria-invalid={!!errors.title}
              />
              <FieldError errors={[errors.title]} />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="description"
          render={({ field }) => (
            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="event-description">Description</FieldLabel>
              <Textarea
                {...field}
                id="event-description"
                placeholder="Tell us about it!"
                className="resize-none"
                aria-invalid={!!errors.description}
              />
              <FieldDescription>
                Optional, up to 250 characters. Shown on the event&apos;s public page.
              </FieldDescription>
              <FieldError errors={[errors.description]} />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="organizer"
          render={({ field }) => (
            <Field data-invalid={!!errors.organizer}>
              <FieldLabel htmlFor="event-organizer">Organizer</FieldLabel>
              <Input
                {...field}
                id="event-organizer"
                placeholder="omsimos"
                aria-invalid={!!errors.organizer}
              />
              <FieldError errors={[errors.organizer]} />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="date"
          render={({ field }) => (
            <Field data-invalid={!!errors.date}>
              <FieldLabel htmlFor="event-date">Date</FieldLabel>
              <Input {...field} id="event-date" type="date" aria-invalid={!!errors.date} />
              <FieldDescription>The day the event was held.</FieldDescription>
              <FieldError errors={[errors.date]} />
            </Field>
          )}
        />

        <TemplatePicker
          template={template ?? "graphite"}
          accent={accentColor ?? DEFAULT_ACCENT}
          onTemplateChange={(t) => form.setValue("template", t, { shouldDirty: true })}
          onAccentChange={(a) => form.setValue("accentColor", a, { shouldDirty: true })}
          logo={{ url: savedLogoUrl, pending: pendingLogo, onChange: setPendingLogo }}
        />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : isEdit ? "Update event" : "Create event"}
        </Button>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <TemplatePreview
          template={template ?? "graphite"}
          accent={accentColor ?? DEFAULT_ACCENT}
          logoUrl={logoUrl}
          preview={{ title: title ?? "", organizer: organizer ?? "", date: date ?? "" }}
        />
      </div>
    </form>
  );
}
