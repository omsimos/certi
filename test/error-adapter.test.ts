import { describe, expect, it } from "vitest";
import { errorNameAdapter } from "../src/lib/error-adapter";
import { hasErrorName } from "../src/lib/errors";

describe("errorNameAdapter", () => {
  it("only claims errors the client branches on", () => {
    const named = Object.assign(new Error("x"), { name: "ForbiddenError" });
    expect(errorNameAdapter.test(named)).toBe(true);
    expect(errorNameAdapter.test(Object.assign(new Error("x"), { name: "ValidationError" }))).toBe(
      true,
    );
    expect(
      errorNameAdapter.test(Object.assign(new Error("x"), { name: "ScheduledEmailCancelError" })),
    ).toBe(true);
    expect(errorNameAdapter.test(new Error("x"))).toBe(false);
    expect(errorNameAdapter.test("ForbiddenError")).toBe(false);
  });

  it("round-trips name and message so hasErrorName matches on the client", () => {
    const original = Object.assign(new Error("Event not found"), { name: "NotFoundError" });
    const wire = errorNameAdapter.toSerializable(original);
    expect(wire).toEqual({ name: "NotFoundError", message: "Event not found" });
    const revived = errorNameAdapter.fromSerializable(wire);
    expect(revived).toBeInstanceOf(Error);
    expect(revived.message).toBe("Event not found");
    expect(hasErrorName(revived, "NotFoundError")).toBe(true);
  });
});
