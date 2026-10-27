import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { getDb } from "@/db";
import { eventCodeSchema } from "@/lib/schemas";
import { renderCertificatePng } from "@/server/cert-image";
import { getCertificatePngWithKey } from "@/server/cert-png";

const ATTENDEE_ID = /^[A-Za-z0-9_-]{10}$/;

export const Route = createFileRoute("/api/cert/$code/$attendeeId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        // Reject malformed input before touching D1, R2 or the renderer.
        if (
          !eventCodeSchema.safeParse(params.code).success ||
          !ATTENDEE_ID.test(params.attendeeId)
        ) {
          return new Response("Not found", { status: 404 });
        }

        const result = await getCertificatePngWithKey(
          { db: getDb(env.DB), bucket: env.BUCKET, render: renderCertificatePng },
          params.code,
          params.attendeeId,
        );
        if (!result) return new Response("Not found", { status: 404 });

        // The key embeds the event version, so it changes exactly when the image does.
        const etag = `"${result.key}"`;
        const headers = new Headers({
          "content-type": "image/png",
          "cache-control": "public, max-age=86400",
          etag,
        });
        if (request.headers.get("if-none-match") === etag) {
          return new Response(null, { status: 304, headers });
        }
        if (new URL(request.url).searchParams.get("download") === "1") {
          headers.set(
            "content-disposition",
            `attachment; filename="certificate-${params.attendeeId}.png"`,
          );
        }
        return new Response(result.png, { headers });
      },
    },
  },
});
