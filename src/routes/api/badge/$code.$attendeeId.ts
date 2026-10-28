import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { getDb } from "@/db";
import { eventCodeSchema } from "@/lib/schemas";
import { attendeeIdSchema, getBadgeImageKey } from "@/server/badge-images";

export const Route = createFileRoute("/api/badge/$code/$attendeeId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (
          !eventCodeSchema.safeParse(params.code).success ||
          !attendeeIdSchema.test(params.attendeeId)
        ) {
          return new Response("Not found", { status: 404 });
        }
        const key = await getBadgeImageKey(getDb(env.DB), params.code, params.attendeeId);
        if (!key) return new Response("Not found", { status: 404 });

        // Keys embed the render version, so the key alone identifies the bytes; any ?v= is ignored.
        const headers = new Headers({
          "content-type": "image/jpeg",
          "cache-control": "public, max-age=0, must-revalidate",
          etag: `"${key}"`,
        });
        const inm = request.headers.get("if-none-match");
        if (inm && inm.split(",").some((t) => t.trim().replace(/^W\//, "") === `"${key}"`)) {
          return new Response(null, { status: 304, headers });
        }
        const obj = await env.BUCKET.get(key);
        if (!obj) return new Response("Not found", { status: 404 });
        return new Response(obj.body, { headers });
      },
    },
  },
});
