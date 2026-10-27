import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { eventCodeSchema } from "@/lib/schemas";
import { findAttendeeFn, getEventFn } from "@/server/fns";

const lookupSchema = z.object({
  email: z.string().trim().pipe(z.email("Enter a valid email address")),
  type: z.enum(["cert", "badge"]),
});
type LookupValues = z.infer<typeof lookupSchema>;

const typeItems = [
  { value: "cert", label: "Certificate" },
  { value: "badge", label: "Badge" },
];

export const Route = createFileRoute("/event/$code/")({
  loader: async ({ params }) => {
    // getEventFn's validator throws on a malformed code; that is simply "not found" here.
    if (!eventCodeSchema.safeParse(params.code).success) throw notFound();
    const event = await getEventFn({ data: { code: params.code } });
    if (!event) throw notFound();
    return { event };
  },
  head: ({ loaderData }) => {
    const event = loaderData?.event;
    if (!event) return {};
    return {
      meta: [
        { title: `${event.title} | Certi` },
        { name: "description", content: event.description },
        { property: "og:title", content: event.title },
        { property: "og:description", content: event.description },
      ],
    };
  },
  component: EventLanding,
});

function EventLanding() {
  const { event } = Route.useLoaderData();
  const navigate = useNavigate();

  const form = useForm<LookupValues>({
    resolver: zodResolver(lookupSchema),
    defaultValues: { email: "", type: "cert" },
  });
  const { errors, isSubmitting } = form.formState;

  async function onSubmit({ email, type }: LookupValues) {
    try {
      const found = await findAttendeeFn({ data: { code: event.code, email } });
      if (!found) {
        toast.error("No certificate found for that email");
        return;
      }
      if (type === "cert") {
        await navigate({
          to: "/event/$code/cert/$attendeeId",
          params: { code: event.code, attendeeId: found.id },
        });
        return;
      }
      await navigate({
        to: "/event/$code/badge/$attendeeId",
        params: { code: event.code, attendeeId: found.id },
      });
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  }

  return (
    <main className="container flex flex-col items-center justify-between gap-20 pt-36 pb-20 lg:flex-row lg:items-start lg:pt-56">
      <div className="space-y-24 text-left">
        <h1 className="bg-zinc-800 from-foreground bg-clip-text text-left text-[10vw] leading-none font-extrabold tracking-tighter text-transparent md:text-7xl dark:bg-linear-to-b dark:to-zinc-400">
          {event.title}
        </h1>

        <div>
          <h2 className="bg-zinc-800 from-foreground bg-clip-text text-left text-xl leading-none font-extrabold tracking-tighter text-transparent md:text-3xl dark:bg-linear-to-b dark:to-zinc-400">
            About the Event
          </h2>
          <p className="mt-3 w-full text-lg break-words hyphens-auto text-muted-foreground md:w-3/4 md:text-xl">
            {event.description}
          </p>
        </div>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader className="text-2xl font-semibold">Enter Email</CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
            <Controller
              control={form.control}
              name="email"
              render={({ field }) => (
                <Field data-invalid={!!errors.email}>
                  <FieldLabel htmlFor="lookup-email">Email</FieldLabel>
                  <Input
                    {...field}
                    id="lookup-email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    autoCapitalize="none"
                    aria-invalid={!!errors.email}
                  />
                  <FieldDescription>Enter your registered email address</FieldDescription>
                  <FieldError errors={[errors.email]} />
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="lookup-type">Select type</FieldLabel>
                  <Select
                    items={typeItems}
                    value={field.value}
                    onValueChange={(value) => value && field.onChange(value)}
                  >
                    <SelectTrigger id="lookup-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {typeItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />

            <Button variant="secondary" type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Searching..." : "Generate"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
