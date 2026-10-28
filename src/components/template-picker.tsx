import { useRouter } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { BadgeCardData } from "@/lib/badge/layout";
import { LogoTooLargeError, rasterizeLogo } from "@/lib/badge/rasterize-logo";
import { BADGE_TEMPLATES, type BadgeTemplate } from "@/lib/badge/templates";
import { formatEventDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { removeLogoFn, uploadLogoFn } from "@/server/fns";

const HoloBadge = lazy(() =>
  import("@/components/badge/holo-badge").then((m) => ({ default: m.HoloBadge })),
);

const LABELS: Record<BadgeTemplate, string> = {
  graphite: "Graphite",
  branded: "Branded",
  id: "ID",
};

export type PreviewEvent = { title: string; organizer: string; date: string };

type Props = {
  template: BadgeTemplate;
  accent: string;
  onTemplateChange: (t: BadgeTemplate) => void;
  /** Fires on the color input's `change` (picker closed), not on every drag. */
  onAccentChange: (accent: string) => void;
  preview: PreviewEvent;
  /** Edit mode only: logos attach to an existing event. */
  logo?: { code: string; url: string | null };
};

const placeholder = <div className="aspect-[300/430] w-full rounded-md bg-[#090a0c]" />;

export function TemplatePicker({
  template,
  accent,
  onTemplateChange,
  onAccentChange,
  preview,
  logo,
}: Props) {
  const router = useRouter();
  const colorRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  // Each accent change re-uploads the shader mask, so only commit once the picker settles.
  const onAccentRef = useRef(onAccentChange);
  useEffect(() => {
    onAccentRef.current = onAccentChange;
  });
  useEffect(() => {
    const el = colorRef.current;
    if (!el) return;
    const commit = () => onAccentRef.current(el.value);
    el.addEventListener("change", commit);
    return () => el.removeEventListener("change", commit);
  }, []);
  useEffect(() => {
    if (colorRef.current) colorRef.current.value = accent;
  }, [accent]);

  const { title, organizer, date } = preview;
  const data = useMemo<BadgeCardData>(
    () => ({
      firstName: "Juan",
      lastName: "Dela Cruz",
      eventTitle: title,
      organizer,
      date: formatEventDate(date),
      attendeeId: "preview000",
      badgeUrl: typeof location === "undefined" ? "" : location.origin,
    }),
    [title, organizer, date],
  );

  async function onFile(file: File | undefined) {
    if (!file || !logo) return;
    setBusy(true);
    try {
      const png = await rasterizeLogo(file);
      const body = new FormData();
      body.set("code", logo.code);
      body.set("file", new File([png], "logo.png", { type: "image/png" }));
      await uploadLogoFn({ data: body });
      toast.success("Logo uploaded");
      await router.invalidate();
    } catch (err) {
      toast.error(
        err instanceof LogoTooLargeError
          ? "That logo is too large even after resizing. Try a simpler image."
          : "Couldn't upload that logo. Try a PNG, JPG or SVG.",
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onRemove() {
    if (!logo) return;
    setBusy(true);
    try {
      await removeLogoFn({ data: { code: logo.code } });
      toast.success("Logo removed");
      await router.invalidate();
    } catch {
      toast.error("Couldn't remove the logo. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Badge template" className="grid grid-cols-3 gap-2">
        {BADGE_TEMPLATES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={template === t}
            onClick={() => onTemplateChange(t)}
            className={cn(
              "flex flex-col gap-2 rounded-lg border p-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
              template === t ? "border-primary ring-1 ring-primary" : "hover:border-foreground/40",
            )}
          >
            <ClientOnly fallback={placeholder}>
              <Suspense fallback={placeholder}>
                <HoloBadge
                  template={t}
                  accent={accent}
                  data={data}
                  logoUrl={logo?.url}
                  interactive={false}
                />
              </Suspense>
            </ClientOnly>
            <span className="font-medium">{LABELS[t]}</span>
          </button>
        ))}
      </div>

      {template === "branded" && (
        <div className="flex flex-col gap-4 rounded-lg border p-3">
          <label className="flex items-center gap-3 text-sm font-medium">
            Accent color
            <input
              ref={colorRef}
              type="color"
              defaultValue={accent}
              className="h-8 w-12 cursor-pointer rounded border bg-transparent"
            />
          </label>
          {logo ? (
            <div className="flex flex-col gap-2">
              <label htmlFor="event-logo" className="text-sm font-medium">
                Logo
              </label>
              <input
                ref={fileRef}
                id="event-logo"
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={(e) => onFile(e.target.files?.[0])}
                className="text-sm"
              />
              {logo.url && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={onRemove}
                >
                  Remove logo
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Add a logo after creating the event.</p>
          )}
        </div>
      )}
    </div>
  );
}
