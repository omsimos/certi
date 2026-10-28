import { describe, expect, it } from "vitest";

import { mergeSummaries, summarizeEmails } from "../src/lib/email-summary";

const now = new Date(2026, 9, 28, 9, 0);
const updatedAt = new Date(2026, 9, 20);
const v = updatedAt;

type Row = Parameters<typeof summarizeEmails>[0][number];
const row = (o: Partial<Row>): Row => ({
  emailStatus: "not_sent",
  emailScheduledFor: null,
  resendId: null,
  badgeImageVersion: null,
  ...o,
});

describe("summarizeEmails", () => {
  it("counts each status", () => {
    const s = summarizeEmails(
      [
        row({ emailStatus: "sent" }),
        row({ emailStatus: "sent" }),
        row({ emailStatus: "not_sent" }),
        row({ emailStatus: "failed" }),
      ],
      updatedAt,
      now,
    );
    expect(s).toMatchObject({ sent: 2, notSent: 1, failed: 1, scheduled: [] });
  });

  it("groups scheduled rows by local date, in order", () => {
    const at = (d: number, h: number) => new Date(2026, 9, d, h, 30);
    const s = summarizeEmails(
      [
        row({ emailStatus: "scheduled", emailScheduledFor: at(30, 9), resendId: "a" }),
        row({ emailStatus: "scheduled", emailScheduledFor: at(29, 23), resendId: "b" }),
        row({ emailStatus: "scheduled", emailScheduledFor: at(30, 1), resendId: "c" }),
      ],
      updatedAt,
      now,
    );
    expect(s.scheduled).toEqual([
      { date: "2026-10-29", count: 1 },
      { date: "2026-10-30", count: 2 },
    ]);
  });

  it("counts a scheduled row whose time has passed as sent", () => {
    const s = summarizeEmails(
      [row({ emailStatus: "scheduled", emailScheduledFor: new Date(2026, 9, 27), resendId: "a" })],
      updatedAt,
      now,
    );
    expect(s).toMatchObject({ sent: 1, scheduled: [] });
  });

  it("needsImage counts missing and stale images of rows to send, not sent rows", () => {
    const s = summarizeEmails(
      [
        row({}),
        row({ emailStatus: "failed", badgeImageVersion: new Date(1) }),
        row({ badgeImageVersion: v }),
        row({ emailStatus: "sent" }),
        row({ emailStatus: "scheduled", emailScheduledFor: new Date(2026, 9, 30), resendId: "a" }),
      ],
      updatedAt,
      now,
    );
    expect(s.needsImage).toBe(2);
  });
});

describe("mergeSummaries", () => {
  it("adds sends, merges slots by time and does not double count repeats", () => {
    const base = { sentNow: 0, failed: 0, missingImage: 0, overflow: 0, remaining: 0 };
    const a = {
      ...base,
      sentNow: 100,
      missingImage: 2,
      overflow: 5,
      remaining: 40,
      scheduled: [{ at: "2026-10-29T09:00:00.000Z", count: 10 }],
      remainingIds: ["x"],
    };
    const b = {
      ...base,
      sentNow: 40,
      failed: 1,
      missingImage: 2,
      overflow: 5,
      scheduled: [{ at: "2026-10-29T09:00:00.000Z", count: 5 }],
      remainingIds: [],
    };
    expect(mergeSummaries(a, b)).toEqual({
      sentNow: 140,
      failed: 1,
      missingImage: 2,
      overflow: 5,
      remaining: 0,
      remainingIds: [],
      scheduled: [{ at: "2026-10-29T09:00:00.000Z", count: 15 }],
    });
  });
});
