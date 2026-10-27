import { z } from "zod";

export const eventCodeSchema = z.string().regex(/^[a-z0-9-]{3,32}$/);

// Rebuilds the date from its parts so impossible dates (2026-02-31, 2026-13-01)
// fail without throwing: Date.UTC overflows instead of raising RangeError.
function isRealDate(s: string): boolean {
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isRealDate);

export const eventInputSchema = z.object({
  code: eventCodeSchema,
  title: z.string().trim().min(2).max(60),
  description: z.string().trim().min(25).max(250),
  organizer: z.string().trim().min(2).max(40),
  date: dateSchema,
});

export const eventUpdateSchema = eventInputSchema.omit({ code: true });

export type EventInput = z.infer<typeof eventInputSchema>;
export type EventUpdate = z.infer<typeof eventUpdateSchema>;
