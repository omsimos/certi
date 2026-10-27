import { notFound, redirect } from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { EventCodeTakenError, ForbiddenError, NotFoundError } from "../src/lib/errors";
import { sanitizeError } from "../src/server/sanitize-error";

describe("sanitizeError", () => {
  it.each([
    ["NotFoundError", new NotFoundError("Event not found")],
    ["ForbiddenError", new ForbiddenError("Sign in required")],
    ["EventCodeTakenError", new EventCodeTakenError("Code taken")],
  ])("keeps name and message of %s but drops stack and cause", (name, original) => {
    (original as Error & { cause?: unknown }).cause = new Error("Failed query: select ...");
    const out = sanitizeError(original);
    expect(out).not.toBe(original);
    expect(out.name).toBe(name);
    expect(out.message).toBe(original.message);
    expect(out.stack).toBeUndefined();
    expect(out.cause).toBeUndefined();
    expect(Object.keys(out)).not.toContain("cause");
  });

  it("turns a ZodError into ValidationError without the issues", () => {
    const result = z.object({ code: z.string() }).safeParse({ code: 1 });
    const out = sanitizeError(result.error);
    expect(out.name).toBe("ValidationError");
    expect(out.message).toBe("Invalid input");
    expect(out.stack).toBeUndefined();
  });

  it("recognises the issue-list Error thrown by the server-fn validator", () => {
    const result = z.object({ code: z.string() }).safeParse({ code: 1 });
    const out = sanitizeError(new Error(JSON.stringify(result.error!.issues, undefined, 2)));
    expect(out.name).toBe("ValidationError");
    expect(out.message).toBe("Invalid input");
  });

  it("does not mistake other JSON messages for validation errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(sanitizeError(new Error("[1, 2, 3]")).message).toBe("Internal error");
    expect(sanitizeError(new Error("[not json")).message).toBe("Internal error");
    spy.mockRestore();
  });

  it("hides unknown errors behind a generic message and logs them", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const original = new Error("Failed query: insert into attendee params: a@b.co", {
      cause: new Error("D1_ERROR"),
    });
    const out = sanitizeError(original);
    expect(out.name).toBe("Error");
    expect(out.message).toBe("Internal error");
    expect(out.stack).toBeUndefined();
    expect(out.cause).toBeUndefined();
    expect(spy).toHaveBeenCalledWith("server function failed", original);
    spy.mockRestore();
  });

  it("wraps thrown non-Error values", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(sanitizeError("boom").message).toBe("Internal error");
    spy.mockRestore();
  });

  it("passes redirect and notFound through unchanged", () => {
    const r = redirect({ to: "/" });
    const n = notFound();
    expect(sanitizeError(r)).toBe(r);
    expect(sanitizeError(n)).toBe(n);
  });
});
