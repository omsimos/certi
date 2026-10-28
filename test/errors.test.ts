import { describe, expect, it } from "vitest";
import { assertUser, EventCodeTakenError, ForbiddenError, NotFoundError } from "../src/lib/errors";

describe("assertUser", () => {
  it("throws ForbiddenError without a session", () => {
    expect(() => assertUser(null)).toThrow(ForbiddenError);
    expect(() => assertUser(undefined)).toThrow("Sign in required");
  });

  it("returns the user from a session", () => {
    const user = { id: "u1", name: "Ada" };
    const session = { user, session: { id: "s1" } };
    expect(assertUser(session)).toBe(user);
  });
});

describe("error classes", () => {
  it("have stable names", () => {
    expect(new NotFoundError("x").name).toBe("NotFoundError");
    expect(new ForbiddenError("x").name).toBe("ForbiddenError");
    expect(new EventCodeTakenError("x").name).toBe("EventCodeTakenError");
  });

  it("are Error instances", () => {
    expect(new NotFoundError("x")).toBeInstanceOf(Error);
  });
});
