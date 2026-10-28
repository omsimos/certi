import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { BADGE_TEMPLATES, DEFAULT_ACCENT } from "@/lib/badge/templates";
import { user } from "./auth-schema";

export * from "./auth-schema";

const EMAIL_STATUSES = ["not_sent", "scheduled", "sent", "failed"] as const;

export const event = sqliteTable("event", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  organizer: text("organizer").notNull(),
  date: text("date").notNull(),
  template: text("template", { enum: BADGE_TEMPLATES }).notNull().default("graphite"),
  accentColor: text("accent_color").notNull().default(DEFAULT_ACCENT),
  logoKey: text("logo_key"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
});

export const attendee = sqliteTable(
  "attendee",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .$defaultFn(() => new Date())
      .notNull(),
    emailStatus: text("email_status", { enum: EMAIL_STATUSES }).notNull().default("not_sent"),
    emailScheduledFor: integer("email_scheduled_for", { mode: "timestamp_ms" }),
    emailSentAt: integer("email_sent_at", { mode: "timestamp_ms" }),
    emailError: text("email_error"),
    // When a send claimed the row; a claim that never recorded a result goes stale.
    emailClaimedAt: integer("email_claimed_at", { mode: "timestamp_ms" }),
    resendId: text("resend_id"),
    badgeImageKey: text("badge_image_key"),
    badgeImageVersion: integer("badge_image_version", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("attendee_email_status").on(t.emailStatus),
    uniqueIndex("attendee_event_email").on(t.eventId, t.email),
    index("attendee_event").on(t.eventId),
  ],
);

export type Event = typeof event.$inferSelect;
export type Attendee = typeof attendee.$inferSelect;
export type EmailStatus = (typeof EMAIL_STATUSES)[number];
