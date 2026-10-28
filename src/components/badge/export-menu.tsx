import { type RefObject, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { canExportGif, canExportMp4, canExportWebp } from "@/lib/badge/export/support";
import type { ExportOptions } from "@/lib/badge/export/types";

import type { HoloBadgeHandle } from "./holo-badge";

type Format = "png" | "mp4" | "webp" | "gif";
type Run = (handle: HoloBadgeHandle, o: ExportOptions) => Promise<Blob>;

const LABELS: Record<Format, string> = {
  png: "PNG",
  mp4: "MP4 · for Instagram / TikTok / X",
  webp: "Animated WebP",
  gif: "GIF",
};

// Encoder modules are imported on click so mediabunny and gifenc stay out of the page load.
const RUNNERS: Record<Format, () => Promise<Run>> = {
  png: async () => (handle) => handle.renderStill({ width: 1080, height: 1536, type: "image/png" }),
  mp4: async () => (await import("@/lib/badge/export/mp4")).exportMp4,
  webp: async () => (await import("@/lib/badge/export/webp")).exportWebp,
  gif: async () => (await import("@/lib/badge/export/gif")).exportGif,
};

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportMenu({
  handle,
  attendeeId,
  backend,
}: {
  handle: RefObject<HoloBadgeHandle | null>;
  attendeeId: string;
  backend: HoloBadgeHandle["backend"] | null;
}) {
  const [supported, setSupported] = useState<Format[]>([]);
  const [running, setRunning] = useState<Format | null>(null);
  const [progress, setProgress] = useState(0);
  const abort = useRef<AbortController | null>(null);

  // Support doesn't depend on the backend; only whether the live badge is WebGPU does.
  useEffect(() => {
    let stale = false;
    const formats = ["mp4", "webp", "gif"] as const;
    const checks = [canExportMp4, canExportWebp, canExportGif];
    void Promise.all(checks.map((c) => c().catch(() => false))).then((ok) => {
      if (!stale) setSupported(formats.filter((_, i) => ok[i]));
    });
    return () => {
      stale = true;
    };
  }, []);

  const available: Format[] = backend === "webgpu" ? ["png", ...supported] : ["png"];

  useEffect(() => () => abort.current?.abort(), []);

  async function run(format: Format) {
    const h = handle.current;
    if (!h || running) return;
    const controller = new AbortController();
    abort.current = controller;
    setProgress(0);
    setRunning(format);
    try {
      const exporter = await RUNNERS[format]();
      const blob = await exporter(h, { signal: controller.signal, onProgress: setProgress });
      download(blob, `badge-${attendeeId}.${format}`);
    } catch (e) {
      if (!controller.signal.aborted) {
        console.error(e);
        toast.error(`Couldn't export the ${LABELS[format].split(" ")[0]}. Try again.`);
      }
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-2">
      {available.map((f) => (
        <Button key={f} variant="outline" disabled={running !== null} onClick={() => run(f)}>
          {LABELS[f]}
        </Button>
      ))}
      {running && (
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-label="Export progress"
            aria-valuenow={Math.round(progress * 100)}
            className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full bg-primary" style={{ width: `${progress * 100}%` }} />
          </div>
          <Button variant="ghost" size="sm" onClick={() => abort.current?.abort()}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
