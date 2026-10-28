import { describe, expect, it } from "vitest";
import { effectiveEmailStatus } from "../src/lib/email-status";

const now = new Date("2026-10-28T09:00:00.000Z");
const row = (o: Partial<Parameters<typeof effectiveEmailStatus>[0]>) => ({
  emailStatus: "scheduled" as const,
  emailScheduledFor: null,
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

  it("keeps a claim that never reached Resend scheduled", () => {
    const past = new Date(now.getTime() - 1);
    expect(effectiveEmailStatus(row({ emailScheduledFor: past, resendId: null }), now)).toBe(
      "scheduled",
    );
  });

  it.each(["not_sent", "sent", "failed"] as const)("passes %s through", (emailStatus) => {
    expect(effectiveEmailStatus(row({ emailStatus, emailScheduledFor: new Date(0) }), now)).toBe(
      emailStatus,
    );
  });
});
