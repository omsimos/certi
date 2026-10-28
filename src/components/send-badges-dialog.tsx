import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Attendee } from "@/db/schema";
import {
  type EmailEvent,
  isStaleVersionError,
  renderEmailImages,
} from "@/lib/badge/render-email-images";
import { probeWebGPU } from "@/lib/badge/webgpu-support";
import { describeSendSummary, planSendWork } from "@/lib/email-summary";
import { sendAllBadges } from "@/lib/send-badges-client";
import type { SendSummary } from "@/server/email/send-badges";

export type SendRow = Pick<
  Attendee,
  | "id"
  | "firstName"
  | "lastName"
  | "emailStatus"
  | "emailScheduledFor"
  | "emailClaimedAt"
  | "resendId"
  | "badgeImageVersion"
>;

type Mode = "rendered" | "simple";
type Phase = "choose" | "rendering" | "sending" | "done";

export function SendBadgesDialog({
  open,
  onOpenChange,
  event,
  logoUrl,
  origin,
  attendees,
  now,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: EmailEvent;
  logoUrl: string | null;
  origin: string;
  attendees: SendRow[];
  now: Date;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("choose");
  const [gpu, setGpu] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>("rendered");
  const [progress, setProgress] = useState<[number, number]>([0, 0]);
  const [summary, setSummary] = useState<SendSummary | null>(null);
  const [renderFailures, setRenderFailures] = useState(0);
  const [refreshed, setRefreshed] = useState(0);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    probeWebGPU().then((ok) => {
      if (cancelled) return;
      setGpu(ok);
      setMode(ok ? "rendered" : "simple");
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const { toSend, staleScheduled, toRender } = planSendWork(attendees, event.updatedAt, now);
  // Only scheduled emails with outdated images: re-upload them, there is nothing to send.
  const refreshOnly = toSend.length === 0 && staleScheduled.length > 0;
  const seconds = Math.max(1, Math.round(0.3 * toRender.length));

  async function start() {
    const controller = new AbortController();
    abort.current = controller;
    try {
      if (toRender.length > 0) {
        setPhase("rendering");
        setProgress([0, toRender.length]);
        const result = await renderEmailImages({
          mode,
          event,
          logoUrl,
          attendees: toRender,
          origin,
          signal: controller.signal,
          onProgress: (done, total) => setProgress([done, total]),
        });
        if (result.failed.some((f) => isStaleVersionError(f.error))) {
          toast.error("The event changed while rendering. Reopen Send badges.");
          onOpenChange(false);
          await router.invalidate();
          return;
        }
        if (controller.signal.aborted) {
          // Keep what was uploaded: the next send renders only the rest.
          setPhase("choose");
          await router.invalidate();
          return;
        }
        setRenderFailures(result.failed.length);
        const failedIds = new Set(result.failed.map((f) => f.id));
        setRefreshed(staleScheduled.filter((a) => !failedIds.has(a.id)).length);
      }
      if (toSend.length > 0) {
        setPhase("sending");
        setSummary(await sendAllBadges(event.code));
      }
      setPhase("done");
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong. Please try again.");
      setPhase("choose");
    }
    await router.invalidate();
  }

  const summaryLines = summary ? describeSendSummary(summary) : [];

  function handleOpenChange(next: boolean) {
    if (!next && phase === "sending") return;
    if (!next) abort.current?.abort();
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{refreshOnly ? "Refresh badge images" : "Send badges"}</DialogTitle>
          {phase === "choose" && (
            <DialogDescription>
              {toSend.length > 0 &&
                `Emails ${toSend.length} ${toSend.length === 1 ? "person" : "people"} their badge. `}
              {staleScheduled.length > 0 &&
                `Updates the image in ${staleScheduled.length} scheduled ${staleScheduled.length === 1 ? "email" : "emails"} to match the event's latest details.`}
            </DialogDescription>
          )}
        </DialogHeader>

        {phase === "choose" && (
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">Email image</legend>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="radio"
                name="mode"
                className="mt-1"
                checked={mode === "rendered"}
                disabled={gpu !== true}
                onChange={() => setMode("rendered")}
              />
              <span>
                <span className="font-medium">Rendered</span>
                <span className="block text-muted-foreground">
                  Uses your browser&apos;s GPU (WebGPU). Keep this tab open while badges render,
                  about {seconds} seconds for this list.
                  {gpu === false && " Not available in this browser."}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="radio"
                name="mode"
                className="mt-1"
                checked={mode === "simple"}
                onChange={() => setMode("simple")}
              />
              <span>
                <span className="font-medium">Simple</span>
                <span className="block text-muted-foreground">
                  A flat badge image without the holographic effect.
                </span>
              </span>
            </label>
          </fieldset>
        )}

        {phase === "rendering" && (
          <p role="status" className="text-sm">
            Rendering {Math.min(progress[0] + 1, progress[1])} of {progress[1]}
          </p>
        )}
        {phase === "sending" && (
          <p role="status" className="text-sm">
            Sending emails...
          </p>
        )}

        {phase === "done" && (
          <div role="status" className="flex flex-col gap-1 text-sm">
            {summaryLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {refreshed > 0 && (
              <p>
                Updated the image in {refreshed} scheduled {refreshed === 1 ? "email" : "emails"}
              </p>
            )}
            {renderFailures > 0 && (
              <p className="text-destructive">{renderFailures} images couldn&apos;t be rendered</p>
            )}
            {summary && summaryLines.length === 0 && <p>Nothing to send.</p>}
          </div>
        )}

        <DialogFooter>
          {phase === "choose" && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button
                onClick={start}
                disabled={gpu === null || (toSend.length === 0 && staleScheduled.length === 0)}
              >
                {refreshOnly ? "Refresh images" : "Send badges"}
              </Button>
            </>
          )}
          {phase === "rendering" && (
            <Button variant="outline" onClick={() => abort.current?.abort()}>
              Cancel
            </Button>
          )}
          {phase === "done" && <Button onClick={() => onOpenChange(false)}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
