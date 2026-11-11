import { describe, expect, it } from "vitest";
import { CLAIM_TIMEOUT_MS } from "../src/lib/email-status";
import { filterAttendees } from "../src/lib/attendee-filter";

const now = new Date("2026-10-28T09:00:00.000Z");
const updatedAt = new Date("2026-10-27T09:00:00.000Z");

const row = (o: Partial<Parameters<typeof filterAttendees>[0][number]> = {}) => ({
  firstName: "Ana",
  lastName: "Cruz",
  email: "ana@example.com",
  badgeImageVersion: null as Date | null,
  emailStatus: "not_sent" as "not_sent" | "scheduled" | "sent" | "failed",
  emailScheduledFor: null as Date | null,
  emailClaimedAt: null as Date | null,
  resendId: null as string | null,
  ...o,
});

const run = (
  rows: ReturnType<typeof row>[],
  query: string,
  status: Parameters<typeof filterAttendees>[1]["status"] = "all",
) => filterAttendees(rows, { query, status }, updatedAt, now);

describe("filterAttendees", () => {
  const ana = row();
  const ben = row({ firstName: "Ben", lastName: "Lee", email: "BLEE@corp.io" });

  it("returns every row, in order, for an empty or blank query", () => {
    expect(run([ana, ben], "")).toEqual([ana, ben]);
    expect(run([ana, ben], "   ")).toEqual([ana, ben]);
  });

  it("matches first name, last name, full name and email", () => {
    expect(run([ana, ben], "ben")).toEqual([ben]);
    expect(run([ana, ben], "cruz")).toEqual([ana]);
    expect(run([ana, ben], "ana cruz")).toEqual([ana]);
    expect(run([ana, ben], "corp.io")).toEqual([ben]);
  });

  it("is case-insensitive and trims the query", () => {
    expect(run([ana, ben], "  ANA CRUZ ")).toEqual([ana]);
    expect(run([ana, ben], "blee@")).toEqual([ben]);
  });

  it("returns nothing when no row matches", () => {
    expect(run([ana, ben], "zzz")).toEqual([]);
  });

  it("counts a past-dated scheduled row with a Resend id as sent", () => {
    const sent = row({
      emailStatus: "scheduled",
      emailScheduledFor: new Date(0),
      resendId: "re_1",
    });
    expect(run([sent, ana], "", "sent")).toEqual([sent]);
    expect(run([sent, ana], "", "scheduled")).toEqual([]);
  });

  it("counts a stale claim as not sent", () => {
    const stale = row({
      emailStatus: "scheduled",
      emailClaimedAt: new Date(now.getTime() - CLAIM_TIMEOUT_MS - 1),
    });
    expect(run([stale], "", "not_sent")).toEqual([stale]);
    expect(run([stale], "", "scheduled")).toEqual([]);
  });

  it("filters failed rows", () => {
    const failed = row({ emailStatus: "failed" });
    expect(run([failed, ana], "", "failed")).toEqual([failed]);
  });

  it("outdated keeps only rows with a non-current image", () => {
    const current = row({ badgeImageVersion: updatedAt });
    const old = row({ badgeImageVersion: new Date(0) });
    expect(run([ana, current, old], "", "outdated")).toEqual([old]);
  });

  it("combines query and status with AND", () => {
    const failedBen = row({ ...ben, emailStatus: "failed" });
    const failedAna = row({ emailStatus: "failed" });
    expect(run([failedBen, failedAna, ben], "ben", "failed")).toEqual([failedBen]);
  });
});
