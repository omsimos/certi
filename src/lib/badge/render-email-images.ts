import type { Attendee } from "@/db/schema";
import { exportPainter } from "@/lib/badge/export-painter";
import { badgeCardData } from "@/lib/badge/card-data";
import { buildLettering } from "@/lib/badge/lettering";
import { STILL_POSE } from "@/lib/badge/pose";
import type { BadgeTemplate } from "@/lib/badge/templates";
import { uploadBadgeImageFn } from "@/server/fns";

export const EMAIL_IMAGE_SIZE = [1200, 1706] as const;
const JPEG_QUALITY = 0.88;

export const isStaleVersionError = (message: string) => message.includes("Event changed");

export type EmailEvent = {
  code: string;
  template: BadgeTemplate;
  accentColor: string;
  updatedAt: Date;
  title: string;
  organizer: string;
  date: string;
};

export type RenderEmailImagesOptions = {
  mode: "rendered" | "simple";
  event: EmailEvent;
  logoUrl: string | null;
  attendees: Pick<Attendee, "id" | "firstName" | "lastName">[];
  origin: string;
  concurrency?: number;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
};

export async function renderEmailImages(
  o: RenderEmailImagesOptions,
): Promise<{ uploaded: number; failed: { id: string; error: string }[] }> {
  const { event, attendees, signal } = o;
  const [width, height] = EMAIL_IMAGE_SIZE;
  const failed: { id: string; error: string }[] = [];
  let uploaded = 0;
  let done = 0;
  if (attendees.length === 0) return { uploaded, failed };

  const cardFor = (a: (typeof attendees)[number]) => badgeCardData(event, a, o.origin);

  const first = await buildLettering(event.template, cardFor(attendees[0]), o.logoUrl);
  const painter = await exportPainter(
    o.mode === "rendered" ? "webgpu" : "flat",
    first,
    event.accentColor,
    width,
    height,
  );

  // The shared canvas can only hold one badge at a time: paint and encode run in turn.
  let encodeQueue: Promise<unknown> = Promise.resolve();
  const encode = (lettering: Awaited<ReturnType<typeof buildLettering>>) => {
    const job = encodeQueue.then(() => {
      painter.setLettering(lettering);
      painter.paint(STILL_POSE);
      return painter.out.convertToBlob({ type: "image/jpeg", quality: JPEG_QUALITY });
    });
    encodeQueue = job.catch(() => undefined);
    return job;
  };

  let stale = false;
  const queue = [...attendees];
  const work = async () => {
    for (let a = queue.shift(); a && !stale; a = queue.shift()) {
      if (signal?.aborted) return;
      try {
        const lettering =
          a === attendees[0] ? first : await buildLettering(event.template, cardFor(a), o.logoUrl);
        const blob = await encode(lettering);
        const body = new FormData();
        body.set("code", event.code);
        body.set("attendeeId", a.id);
        body.set("version", String(event.updatedAt.getTime()));
        body.set("file", new File([blob], "badge.jpg", { type: "image/jpeg" }));
        await uploadBadgeImageFn({ data: body });
        uploaded++;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        failed.push({ id: a.id, error: message });
        // Every remaining image would be rejected the same way.
        if (isStaleVersionError(message)) stale = true;
      }
      o.onProgress?.(++done, attendees.length);
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.max(1, o.concurrency ?? 4) }, work));
  } finally {
    painter.dispose();
  }
  return { uploaded, failed };
}
