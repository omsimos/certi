import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { z } from "zod";

import { getDb } from "@/db";
import { auth } from "@/lib/auth";
import { assertUser } from "@/lib/errors";
import { eventCodeSchema, eventInputSchema, eventUpdateSchema } from "@/lib/schemas";
import {
  createEvent,
  getEventByCode,
  getOwnedEvent,
  listEventsByOwner,
  toPublicEvent,
  updateEvent,
} from "@/server/events";

export const authMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  return next({ context: { user: assertUser(session) } });
});

export const getSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  const session = await auth.api.getSession({ headers: getRequestHeaders() });
  return session ? { user: session.user } : null;
});

const codeInput = z.object({ code: eventCodeSchema });

export const createEventFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(eventInputSchema)
  .handler(({ data, context }) => createEvent(getDb(env.DB), context.user.id, data));

export const updateEventFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(eventUpdateSchema.extend({ code: eventCodeSchema }))
  .handler(({ data: { code, ...input }, context }) =>
    updateEvent(getDb(env.DB), context.user.id, code, input),
  );

export const getEventFn = createServerFn({ method: "GET" })
  .validator(codeInput)
  .handler(async ({ data }) => {
    const row = await getEventByCode(getDb(env.DB), data.code);
    return row ? toPublicEvent(row) : null;
  });

export const listMyEventsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(({ context }) => listEventsByOwner(getDb(env.DB), context.user.id));

export const getOwnedEventFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(codeInput)
  .handler(({ data, context }) => getOwnedEvent(getDb(env.DB), context.user.id, data.code));
