import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import Tilt from "react-parallax-tilt";
import { toast } from "sonner";

import { CertificateCard } from "@/components/certificate-card";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { getCertificateFn, getOriginFn } from "@/server/fns";

export const Route = createFileRoute("/event/$code/cert/$attendeeId")({
  loader: async ({ params }) => {
    const [cert, origin] = await Promise.all([
      getCertificateFn({ data: { code: params.code, attendeeId: params.attendeeId } }),
      getOriginFn(),
    ]);
    if (!cert) throw notFound();
    return { ...cert, origin };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return {};
    const { attendee, event, origin } = loaderData;
    const title = `${attendee.firstName} ${attendee.lastName} | ${event.title}`;
    const description = `Certificate of participation in ${event.title} by ${event.organizer}.`;
    const image = `${origin}/api/cert/${params.code}/${params.attendeeId}`;
    return {
      meta: [
        { title: `${title} | Certi` },
        { name: "description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:image", content: image },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: image },
      ],
    };
  },
  component: CertificatePage,
});

function CertificatePage() {
  const { attendee, event } = Route.useLoaderData();
  const { code, attendeeId } = Route.useParams();
  const [, copy] = useCopyToClipboard();

  async function copyLink() {
    if (await copy(window.location.href)) toast.success("Link copied");
    else toast.error("Could not copy the link");
  }

  return (
    <main className="container flex min-h-screen flex-col items-center justify-center py-24">
      <Tilt>
        <CertificateCard attendee={attendee} event={event} onCopyLink={copyLink} />
      </Tilt>

      <div className="mt-8 flex items-center gap-2 sm:gap-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back to event"
          nativeButton={false}
          render={<Link to="/event/$code" params={{ code }} />}
        >
          <ArrowLeftIcon />
        </Button>
        <Button variant="outline" type="button" onClick={copyLink}>
          Copy link
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<a href={`/api/cert/${code}/${attendeeId}?download=1`} />}
        >
          Download
        </Button>
      </div>
    </main>
  );
}
