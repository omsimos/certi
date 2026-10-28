import { describe, expect, it } from "vitest";
import { accentColorSchema } from "../src/lib/badge/templates";
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

describe("accentColorSchema", () => {
  it("accepts 6-digit hex in any case", () => {
    expect(accentColorSchema.safeParse("#A1b2C3").success).toBe(true);
  });

  it.each(["red", "#12345", "#12345g"])("rejects %s", (v) => {
    expect(accentColorSchema.safeParse(v).success).toBe(false);
  });
});
