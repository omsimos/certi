import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { getDb } from "@/db";
import { eventCodeSchema } from "@/lib/schemas";
import { getEventByCode } from "@/server/events";

export const Route = createFileRoute("/api/logo/$code")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!eventCodeSchema.safeParse(params.code).success) {
          return new Response("Not found", { status: 404 });
        }
        const row = await getEventByCode(getDb(env.DB), params.code);
        if (!row?.logoKey) return new Response("Not found", { status: 404 });

        // Keys embed the upload time, so the key alone identifies the bytes.
        const headers = new Headers({
          "content-type": "image/png",
          "cache-control": "public, max-age=0, must-revalidate",
          etag: `"${row.logoKey}"`,
        });
        const inm = request.headers.get("if-none-match");
        if (
          inm &&
          inm.split(",").some((t) => t.trim().replace(/^W\//, "") === `"${row.logoKey}"`)
        ) {
          return new Response(null, { status: 304, headers });
        }
        const obj = await env.BUCKET.get(row.logoKey);
        if (!obj) return new Response("Not found", { status: 404 });
        return new Response(obj.body, { headers });
      },
    },
  },
});
