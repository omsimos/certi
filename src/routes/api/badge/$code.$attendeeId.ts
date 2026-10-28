import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { getDb } from "@/db";
import { eventCodeSchema } from "@/lib/schemas";
import { attendeeIdSchema, getBadgeImage } from "@/server/badge-images";

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
        const img = await getBadgeImage(getDb(env.DB), env.BUCKET, params.code, params.attendeeId);
        if (!img) return new Response("Not found", { status: 404 });

        // Keys embed the render version, so the key alone identifies the bytes; any ?v= is ignored.
        const headers = new Headers({
          "content-type": "image/jpeg",
          "cache-control": "public, max-age=0, must-revalidate",
          etag: `"${img.key}"`,
        });
        const inm = request.headers.get("if-none-match");
        if (inm && inm.split(",").some((t) => t.trim().replace(/^W\//, "") === `"${img.key}"`)) {
          void img.body.cancel();
          return new Response(null, { status: 304, headers });
        }
        return new Response(img.body, { headers });
      },
    },
  },
});
