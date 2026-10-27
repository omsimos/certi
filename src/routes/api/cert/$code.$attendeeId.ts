import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { getDb } from "@/db";
import { eventCodeSchema } from "@/lib/schemas";
import { renderCertificatePng } from "@/server/cert-image";
import { etagMatches, getCertificatePngWithKey } from "@/server/cert-png";

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

        let result;
        try {
          result = await getCertificatePngWithKey(
            { db: getDb(env.DB), bucket: env.BUCKET, render: renderCertificatePng },
            params.code,
            params.attendeeId,
          );
        } catch (error) {
          // Render and font-fetch failures are usually transient; nothing was cached.
          console.error("certificate png failed", params.code, params.attendeeId, error);
          return new Response("Certificate temporarily unavailable", {
            status: 503,
            headers: { "retry-after": "30", "cache-control": "no-store" },
          });
        }
        if (!result) return new Response("Not found", { status: 404 });

        // The key embeds the event version, so it changes exactly when the image does.
        // Clients revalidate every time: that costs one D1 + R2 lookup, never a render.
        const etag = `"${result.key}"`;
        const headers = new Headers({
          "content-type": "image/png",
          "cache-control": "public, max-age=0, must-revalidate",
          etag,
        });
        if (etagMatches(request.headers.get("if-none-match"), etag)) {
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
