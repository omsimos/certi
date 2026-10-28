import { describe, expect, it } from "vitest";
import { badgeCardData } from "../src/lib/badge/card-data";

describe("badgeCardData", () => {
  it("formats the event date the same way as the rest of the app", () => {
    const card = badgeCardData(
      { code: "ABC123", title: "DevCon", organizer: "Org", date: "2026-11-05" },
      { id: "a1b2c3d4e5", firstName: "Juan", lastName: "Dela Cruz" },
      "https://certi.test",
    );
    expect(card).toEqual({
      firstName: "Juan",
      lastName: "Dela Cruz",
      eventTitle: "DevCon",
      organizer: "Org",
      date: "November 5, 2026",
      attendeeId: "a1b2c3d4e5",
      badgeUrl: "https://certi.test/event/ABC123/badge/a1b2c3d4e5",
    });
  });
});
