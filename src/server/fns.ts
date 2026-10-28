import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { getRequestHeaders, getRequestUrl } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import { z } from "zod";

import { getDb } from "@/db";
import { auth } from "@/lib/auth";
import { assertUser } from "@/lib/errors";
import {
  attendeeInputSchema,
  eventCodeSchema,
  eventInputSchema,
  eventUpdateSchema,
  MAX_ATTENDEES_PER_IMPORT,
} from "@/lib/schemas";
import { parseLogoUpload, removeEventLogo, saveEventLogo } from "@/server/assets";
import { parseBadgeImageUpload, saveBadgeImage } from "@/server/badge-images";
import { deleteAttendee, getBadge, importAttendees, listAttendees } from "@/server/attendees";
import { createEmailClient } from "@/server/email/client";
import { readEmailConfig } from "@/server/email/config";
import { sendBadges } from "@/server/email/send-badges";
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

// The canonical origin: absolute URLs (og:image, the QR on emailed badges, email links) must agree.
const publicOrigin = () => env.BETTER_AUTH_URL || getRequestUrl().origin;

export const getOriginFn = createServerFn({ method: "GET" }).handler(publicOrigin);

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

export const importAttendeesFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      code: eventCodeSchema,
      attendees: z.array(attendeeInputSchema).max(MAX_ATTENDEES_PER_IMPORT),
    }),
  )
  .handler(({ data, context }) =>
    importAttendees(getDb(env.DB), context.user.id, data.code, data.attendees),
  );

export const listAttendeesFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator(codeInput)
  .handler(({ data, context }) => listAttendees(getDb(env.DB), context.user.id, data.code));

export const deleteAttendeeFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ code: eventCodeSchema, attendeeId: z.string().min(1).max(64) }))
  .handler(({ data, context }) =>
    deleteAttendee(getDb(env.DB), env.BUCKET, context.user.id, data.code, data.attendeeId, {
      // Built lazily: only a scheduled email needs Resend, so deletes work without a key.
      cancel: (resendId) => createEmailClient(readEmailConfig(env)).cancel(resendId),
    }),
  );

export const sendBadgesFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      code: eventCodeSchema,
      attendeeIds: z
        .array(z.string().regex(/^[A-Za-z0-9_-]{10}$/))
        .max(2000)
        .optional(),
    }),
  )
  .handler(({ data, context }) => {
    const cfg = readEmailConfig(env);
    return sendBadges(
      {
        db: getDb(env.DB),
        client: createEmailClient(cfg),
        now: new Date(),
        dailyLimit: cfg.dailyLimit,
        origin: publicOrigin(),
        from: cfg.from,
      },
      context.user.id,
      data.code,
      { attendeeIds: data.attendeeIds },
    );
  });

// The public lookup validates loosely and re-checks inside the handler, so a
// malformed code or id yields `null` ("not found") rather than a thrown error.
const attendeeIdSchema = z.string().regex(/^[A-Za-z0-9_-]{10}$/);

// Badge pages are shared publicly, so the email and ownerId never leave the server.
export const getBadgeFn = createServerFn({ method: "GET" })
  .validator(z.object({ code: z.string().max(64), attendeeId: z.string().max(64) }))
  .handler(async ({ data }) => {
    const code = eventCodeSchema.safeParse(data.code);
    const id = attendeeIdSchema.safeParse(data.attendeeId);
    if (!code.success || !id.success) return null;
    const badge = await getBadge(getDb(env.DB), code.data, id.data);
    if (!badge) return null;
    const { id: attendeeId, firstName, lastName } = badge.attendee;
    return {
      attendee: { id: attendeeId, firstName, lastName },
      event: toPublicEvent(badge.event),
      // Lets the page emit og:image only when an image exists, and bust link-preview caches.
      imageVersion: badge.attendee.badgeImageVersion?.getTime() ?? null,
    };
  });

export const uploadBadgeImageFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parseBadgeImageUpload)
  .handler(async ({ data, context }) => {
    await saveBadgeImage(
      getDb(env.DB),
      env.BUCKET,
      context.user.id,
      data.code,
      data.attendeeId,
      new Uint8Array(await data.file.arrayBuffer()),
      data.version,
    );
  });

export const uploadLogoFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(parseLogoUpload)
  .handler(async ({ data, context }) =>
    saveEventLogo(
      getDb(env.DB),
      env.BUCKET,
      context.user.id,
      data.code,
      new Uint8Array(await data.file.arrayBuffer()),
    ),
  );

export const removeLogoFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(codeInput)
  .handler(({ data, context }) =>
    removeEventLogo(getDb(env.DB), env.BUCKET, context.user.id, data.code),
  );
