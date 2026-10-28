import { describe, expect, it } from "vitest";
import { CLAIM_TIMEOUT_MS, effectiveEmailStatus } from "../src/lib/email-status";

const now = new Date("2026-10-28T09:00:00.000Z");
const row = (o: Partial<Parameters<typeof effectiveEmailStatus>[0]>) => ({
  emailStatus: "scheduled" as const,
  emailScheduledFor: null,
  emailClaimedAt: null,
  resendId: "re_1",
  ...o,
});

describe("effectiveEmailStatus", () => {
  it("treats a scheduled email whose time has come as sent", () => {
    expect(effectiveEmailStatus(row({ emailScheduledFor: now }), now)).toBe("sent");
    expect(effectiveEmailStatus(row({ emailScheduledFor: new Date(0) }), now)).toBe("sent");
  });

  it("keeps a future schedule scheduled", () => {
    const later = new Date(now.getTime() + 1);
    expect(effectiveEmailStatus(row({ emailScheduledFor: later }), now)).toBe("scheduled");
  });

  it("keeps a fresh claim that hasn't reached Resend yet scheduled", () => {
    const past = new Date(now.getTime() - 1);
    const cutoff = new Date(now.getTime() - CLAIM_TIMEOUT_MS);
    for (const emailClaimedAt of [now, cutoff]) {
      expect(
        effectiveEmailStatus(row({ emailScheduledFor: past, resendId: null, emailClaimedAt }), now),
      ).toBe("scheduled");
    }
  });

  it("treats a stale claim as not sent, as the next send retries it", () => {
    const stale = new Date(now.getTime() - CLAIM_TIMEOUT_MS - 1);
    for (const emailClaimedAt of [stale, null]) {
      expect(
        effectiveEmailStatus(row({ emailScheduledFor: now, resendId: null, emailClaimedAt }), now),
      ).toBe("not_sent");
    }
  });

  it.each(["not_sent", "sent", "failed"] as const)("passes %s through", (emailStatus) => {
    expect(effectiveEmailStatus(row({ emailStatus, emailScheduledFor: new Date(0) }), now)).toBe(
      emailStatus,
    );
  });
});
