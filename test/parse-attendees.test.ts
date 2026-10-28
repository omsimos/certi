import { describe, expect, it } from "vitest";
import { parseAttendeeRows } from "../src/lib/attendee-rows";

const valid = { firstName: "Ana", lastName: "Cruz", email: "ana@x.com" };

describe("parseAttendeeRows", () => {
  it("normalizes headers, trims, lowercases email", () => {
    const r = parseAttendeeRows([
      { "First Name": " Ana ", last_name: "Cruz", Email: " Ana@X.com ", Org: "x" },
    ]);
    expect(r).toEqual({
      attendees: [{ firstName: "Ana", lastName: "Cruz", email: "ana@x.com" }],
      errors: [],
      duplicates: 0,
    });
  });

  it("maps header aliases", () => {
    const r = parseAttendeeRows([{ First: "A", Surname: "B", "E-mail Address": "a@b.co" }]);
    expect(r.attendees).toEqual([{ firstName: "A", lastName: "B", email: "a@b.co" }]);
    const r2 = parseAttendeeRows([{ first: "A", last: "B", mail: "a@b.co" }]);
    expect(r2.attendees).toHaveLength(1);
  });

  it("skips fully blank rows", () => {
    const r = parseAttendeeRows([valid, { firstName: "", email: "" }]);
    expect(r.attendees).toHaveLength(1);
    expect(r.errors).toEqual([]);
  });

  it("reports invalid email with its row", () => {
    const r = parseAttendeeRows([valid, { firstName: "B", lastName: "C", email: "nope" }]);
    expect(r.errors).toEqual([{ row: 2, message: "Invalid email" }]);
  });

  it("reports a missing name", () => {
    const r = parseAttendeeRows([{ firstName: "", lastName: "C", email: "c@x.com" }]);
    expect(r.errors).toEqual([{ row: 1, message: "First name is required" }]);
  });

  it("accepts numeric cell values without throwing", () => {
    const r = parseAttendeeRows([{ firstName: 1, lastName: 2, email: "n@x.com" }]);
    expect(r.attendees).toEqual([{ firstName: "1", lastName: "2", email: "n@x.com" }]);
  });

  it("dedupes by email within the file", () => {
    const r = parseAttendeeRows([valid, { ...valid, firstName: "Dup", email: "ANA@x.com" }]);
    expect(r.attendees).toEqual([valid]);
    expect(r.duplicates).toBe(1);
  });

  it("rejects names longer than 60 chars", () => {
    const r = parseAttendeeRows([{ ...valid, firstName: "a".repeat(61) }]);
    expect(r.attendees).toEqual([]);
    expect(r.errors[0].row).toBe(1);
  });

  it("rejects more than 2000 rows", () => {
    const rows = Array.from({ length: 2001 }, (_, i) => ({ ...valid, email: `a${i}@x.com` }));
    expect(parseAttendeeRows(rows)).toEqual({
      attendees: [],
      errors: [{ row: 0, message: "Too many rows (max 2000)" }],
      duplicates: 0,
    });
  });
});
