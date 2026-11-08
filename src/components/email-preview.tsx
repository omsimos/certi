import { useEffect, useState } from "react";

import type { Attendee } from "@/db/schema";
import { badgeCardData } from "@/lib/badge/card-data";
import { type EmailEvent, renderEmailImagePreview } from "@/lib/badge/render-email-images";
import { buildPreviewDocument } from "@/lib/email-preview-document";

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

type State =
  | { status: "rendering" }
  | { status: "failed" }
  | { status: "ready"; subject: string; html: string };

// Mount it with key={mode}: a new mode restarts from the "rendering" state.
export function EmailPreview({
  mode,
  event,
  logoUrl,
  attendee,
  origin,
}: {
  mode: "rendered" | "simple";
  event: EmailEvent;
  logoUrl: string | null;
  attendee: Pick<Attendee, "id" | "firstName" | "lastName">;
  origin: string;
}) {
  const [state, setState] = useState<State>({ status: "rendering" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const blob = await renderEmailImagePreview({ mode, event, logoUrl, attendee, origin });
        // A blob: URL may not load inside a sandboxed iframe.
        const imageUrl = await toDataUrl(blob);
        if (cancelled) return;
        const doc = buildPreviewDocument({
          firstName: attendee.firstName,
          eventTitle: event.title,
          organizer: event.organizer,
          badgeUrl: badgeCardData(event, attendee, origin).badgeUrl,
          imageUrl,
        });
        setState({ status: "ready", ...doc });
      } catch (err) {
        console.error(err);
        if (!cancelled) setState({ status: "failed" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, event, logoUrl, attendee, origin]);

  if (state.status === "rendering") {
    return (
      <>
        <div className="aspect-[3/4] w-full animate-pulse rounded-lg bg-muted" />
        <p role="status" className="text-sm text-muted-foreground">
          Rendering preview…
        </p>
      </>
    );
  }
  if (state.status === "failed") {
    return (
      <p className="text-sm text-muted-foreground">
        Couldn&apos;t render the preview. You can still send.
      </p>
    );
  }
  return (
    <>
      <p className="text-sm">Subject: {state.subject}</p>
      <iframe
        title="Email preview"
        sandbox=""
        srcDoc={state.html}
        className="h-[420px] w-full rounded-lg border bg-white"
      />
    </>
  );
}
