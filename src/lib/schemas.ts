import { z } from "zod";

export const eventCodeSchema = z
  .string()
  .regex(/^[a-z0-9-]{3,32}$/, "Use 3-32 lowercase letters, numbers or dashes");

// Rebuilds the date from its parts so impossible dates (2026-02-31, 2026-13-01)
// fail without throwing: Date.UTC overflows instead of raising RangeError.
function isRealDate(s: string): boolean {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
  .refine(isRealDate, "Pick a valid date");

export const eventInputSchema = z.object({
  code: eventCodeSchema,
  title: z
    .string()
    .trim()
    .min(2, "Title must be at least 2 characters")
    .max(60, "Title must be at most 60 characters"),
  description: z
    .string()
    .trim()
    .min(25, "Description must be at least 25 characters")
    .max(250, "Description must be at most 250 characters"),
  organizer: z
    .string()
    .trim()
    .min(2, "Organizer must be at least 2 characters")
    .max(40, "Organizer must be at most 40 characters"),
  date: dateSchema,
});

export const eventUpdateSchema = eventInputSchema.omit({ code: true });

const nameSchema = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(60, `${label} must be at most 60 characters`);

export const attendeeInputSchema = z.object({
  firstName: nameSchema("First name"),
  lastName: nameSchema("Last name"),
  email: z.string().trim().toLowerCase().pipe(z.email("Invalid email")),
});

export const MAX_ATTENDEES_PER_IMPORT = 2000;

export type EventInput = z.infer<typeof eventInputSchema>;
export type EventUpdate = z.infer<typeof eventUpdateSchema>;
export type AttendeeInput = z.infer<typeof attendeeInputSchema>;
