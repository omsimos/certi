ALTER TABLE `attendee` ADD `email_status` text DEFAULT 'not_sent' NOT NULL;--> statement-breakpoint
ALTER TABLE `attendee` ADD `email_scheduled_for` integer;--> statement-breakpoint
ALTER TABLE `attendee` ADD `email_sent_at` integer;--> statement-breakpoint
ALTER TABLE `attendee` ADD `email_error` text;--> statement-breakpoint
ALTER TABLE `attendee` ADD `resend_id` text;--> statement-breakpoint
ALTER TABLE `attendee` ADD `badge_image_key` text;--> statement-breakpoint
ALTER TABLE `attendee` ADD `badge_image_version` integer;--> statement-breakpoint
CREATE INDEX `attendee_email_status` ON `attendee` (`email_status`);--> statement-breakpoint
ALTER TABLE `event` ADD `template` text DEFAULT 'graphite' NOT NULL;--> statement-breakpoint
ALTER TABLE `event` ADD `accent_color` text DEFAULT '#6d3cff' NOT NULL;--> statement-breakpoint
ALTER TABLE `event` ADD `logo_key` text;