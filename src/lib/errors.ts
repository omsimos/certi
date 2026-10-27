// Kept free of auth/cloudflare imports so it stays unit-testable anywhere.
// Explicit `name`s survive minification and serialization across server fns.
export class NotFoundError extends Error {
  override name = "NotFoundError";
}

export class ForbiddenError extends Error {
  override name = "ForbiddenError";
}

export class EventCodeTakenError extends Error {
  override name = "EventCodeTakenError";
}

export function assertUser<U>(session: { user: U } | null | undefined): U {
  if (!session) throw new ForbiddenError("Sign in required");
  return session.user;
}
