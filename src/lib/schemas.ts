import { z } from "zod";

export const eventCodeSchema = z.string().regex(/^[a-z0-9-]{3,32}$/);

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  // The regex alone accepts impossible dates like 2026-02-31.
  .refine((s) => new Date(`${s}T00:00:00Z`).toISOString().startsWith(s));

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
