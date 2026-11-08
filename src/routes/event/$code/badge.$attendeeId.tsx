import { ClientOnly, createFileRoute, Link, notFound } from "@tanstack/react-router";
import { lazy, Suspense, useRef, useState } from "react";
import { toast } from "sonner";

import type { HoloBadgeHandle } from "@/components/badge/holo-badge";

import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { badgeCardData } from "@/lib/badge/card-data";
import { badgeFileName } from "@/lib/badge/file-name";
import { EMAIL_IMAGE_SIZE } from "@/lib/badge/email-image-size";
import { getBadgeFn, getOriginFn } from "@/server/fns";

const ExportMenu = lazy(() =>
  import("@/components/badge/export-menu").then((m) => ({ default: m.ExportMenu })),
);
const HoloBadge = lazy(() =>
  import("@/components/badge/holo-badge").then((m) => ({ default: m.HoloBadge })),
);

export const Route = createFileRoute("/event/$code/badge/$attendeeId")({
  loader: async ({ params }) => {
    const [badge, origin] = await Promise.all([
      getBadgeFn({ data: { code: params.code, attendeeId: params.attendeeId } }),
      getOriginFn(),
    ]);
    if (!badge) throw notFound();
    const { attendee, event, imageVersion } = badge;
    const card = badgeCardData(event, attendee, origin);
    // The version busts the logo cache whenever the event (and so its logo) changes.
    const logoUrl = event.logoKey ? `/api/logo/${event.code}?v=${event.updatedAt.getTime()}` : null;
    const imageUrl =
      imageVersion === null
        ? null
        : `${origin}/api/badge/${event.code}/${attendee.id}?v=${imageVersion}`;
    return { attendee, event, card, logoUrl, imageUrl };
  },
  staticData: { attendeeFacing: true },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { attendee, event, card, imageUrl } = loaderData;
    const subtitle = `${event.organizer} · ${card.date}`;
    return {
      meta: [
        { title: `${attendee.firstName} ${attendee.lastName} | ${event.title} | Certi` },
        { name: "description", content: subtitle },
        { property: "og:type", content: "website" },
        { property: "og:url", content: card.badgeUrl },
        {
          property: "og:title",
          content: `${attendee.firstName} ${attendee.lastName} · ${event.title}`,
        },
        { property: "og:description", content: subtitle },
        // No placeholder image: a preview without og:image is better than a wrong one.
        ...(imageUrl
          ? [
              { property: "og:image", content: imageUrl },
              { property: "og:image:width", content: String(EMAIL_IMAGE_SIZE[0]) },
              { property: "og:image:height", content: String(EMAIL_IMAGE_SIZE[1]) },
              { name: "twitter:card", content: "summary_large_image" },
              { name: "twitter:image", content: imageUrl },
            ]
          : [{ name: "twitter:card", content: "summary" }]),
      ],
    };
  },
  component: BadgePage,
});

const placeholder = <div className="aspect-[300/430] w-full rounded-xl bg-[#090a0c]" />;

function BadgePage() {
  const { event, card, logoUrl } = Route.useLoaderData();
  const badge = useRef<HoloBadgeHandle>(null);
  const [backend, setBackend] = useState<HoloBadgeHandle["backend"] | null>(null);
  const [, copy] = useCopyToClipboard();

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${card.firstName}'s badge for ${event.title}`,
          url: card.badgeUrl,
        });
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) console.error(e);
      }
      return;
    }
    if (await copy(card.badgeUrl)) toast.success("Link copied");
    else toast.error("Could not copy the link");
  }
  return (
    <main className="container flex min-h-screen flex-col items-center justify-center gap-6 py-24">
      <div className="flex flex-col gap-1">
        <h1 className="text-center text-2xl font-semibold tracking-tight">{event.title}</h1>
        <p className="text-center text-sm text-muted-foreground">
          {event.organizer} · {card.date}
        </p>
      </div>
      <div className="w-full max-w-sm">
        <ClientOnly fallback={placeholder}>
          <Suspense fallback={placeholder}>
            <HoloBadge
              template={event.template}
              accent={event.accentColor}
              data={card}
              logoUrl={logoUrl}
              ref={badge}
              onBackendChange={setBackend}
            />
          </Suspense>
        </ClientOnly>
      </div>
      <ClientOnly>
        <Button className="w-full max-w-sm" onClick={share}>
          Share
        </Button>
        <Suspense>
          <ExportMenu
            handle={badge}
            fileName={(ext) => badgeFileName(card.firstName, card.lastName, event.code, ext)}
            backend={backend}
          />
        </Suspense>
      </ClientOnly>
      <p className="text-xs text-muted-foreground">
        Made with <Link to="/">Certi</Link>
      </p>
    </main>
  );
}
