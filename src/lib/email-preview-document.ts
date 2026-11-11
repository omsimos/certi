import { type BadgeEmailData, renderBadgeEmailDirect } from "@/server/email/badge-email";

// Kept apart from the component so tests don't pull in the server-fn import chain.
export function buildPreviewDocument(d: BadgeEmailData): { subject: string; html: string } {
  const { subject, html } = renderBadgeEmailDirect(d);
  return { subject, html };
}
