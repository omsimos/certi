import { describe, expect, it } from "vitest";
import { attendeeInputSchema } from "../src/lib/schemas";

describe("attendeeInputSchema email length", () => {
  const base = { firstName: "A", lastName: "B" };
  const emailOfLength = (len: number) => `${"a".repeat(len - "@x.co".length)}@x.co`;

  it("accepts 254 characters and rejects 255", () => {
    expect(attendeeInputSchema.safeParse({ ...base, email: emailOfLength(254) }).success).toBe(
      true,
    );
    const over = attendeeInputSchema.safeParse({ ...base, email: emailOfLength(255) });
    expect(over.success).toBe(false);
    expect(over.error?.issues[0].message).toBe("Email is too long");
  });
});
