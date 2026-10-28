import { emptySummary, mergeSummaries } from "@/lib/email-summary";
import type { SendSummary } from "@/server/email/send-badges";
import { sendBadgesFn } from "@/server/fns";

// Each call handles at most 100 emails. A call that leaves `remaining` always made
// progress, so this ends. A per-row send continues with `remainingIds`; the original
// ids would email the already-sent ones again.
export async function sendAllBadges(code: string, attendeeIds?: string[]): Promise<SendSummary> {
  let total = emptySummary();
  let ids = attendeeIds;
  for (;;) {
    const next = await sendBadgesFn({ data: { code, attendeeIds: ids } });
    total = mergeSummaries(total, next, { bulk: ids === undefined });
    if (next.remaining <= 0) return total;
    if (ids) ids = next.remainingIds;
  }
}
