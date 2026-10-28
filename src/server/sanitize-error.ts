import { isNotFound, isRedirect } from "@tanstack/react-router";
import { ZodError } from "zod";

import { EventCodeTakenError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

// Domain errors whose message is written for users and safe to show.
const DOMAIN_ERRORS = [NotFoundError, ForbiddenError, EventCodeTakenError, ValidationError];

// Standard Schema validators (zod 4 included) make the server-fn core throw a plain
// `Error` whose message is the JSON-stringified issue list, so `instanceof` can't catch them.
function isIssueListMessage(message: string): boolean {
  if (!message.startsWith("[")) return false;
  try {
    const issues: unknown = JSON.parse(message);
    return (
      Array.isArray(issues) &&
      issues.length > 0 &&
      issues.every(
        (i) => typeof i === "object" && i !== null && typeof i.message === "string" && "path" in i,
      )
    );
  } catch {
    return false;
  }
}

function plainError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  // Seroval serializes own props, and `stack` would reach the browser.
  delete error.stack;
  return error;
}

// Server-fn errors are serialized with every own prop (`stack`, drizzle's `cause` with the
// failed SQL and params, ...). Everything that leaves the server goes through here first.
export function sanitizeError(err: unknown): Error {
  // Redirects and notFound() are control flow handled by the router, not failures.
  if (isRedirect(err) || isNotFound(err) || err instanceof Response) return err as Error;
  if (DOMAIN_ERRORS.some((E) => err instanceof E)) {
    const { name, message } = err as Error;
    return plainError(name, message);
  }
  if (err instanceof ZodError || (err instanceof Error && isIssueListMessage(err.message))) {
    return plainError("ValidationError", "Invalid input");
  }
  console.error("server function failed", err);
  return plainError("Error", "Internal error");
}
