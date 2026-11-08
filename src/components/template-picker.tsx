import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { BadgeCardData } from "@/lib/badge/layout";
import { LogoTooLargeError, rasterizeLogo } from "@/lib/badge/rasterize-logo";
import { BADGE_TEMPLATES, type BadgeTemplate } from "@/lib/badge/templates";
import { commitOnChange } from "@/lib/commit-on-change";
import { formatEventDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const HoloBadge = lazy(() =>
  import("@/components/badge/holo-badge").then((m) => ({ default: m.HoloBadge })),
);

const OPTIONS: Record<BadgeTemplate, { label: string; description: string }> = {
  graphite: { label: "Graphite", description: "Dark card, name along the bottom" },
  branded: { label: "Branded", description: "Your accent colour and logo" },
  id: { label: "ID", description: "Adds a QR code to the badge page" },
};

export type PreviewEvent = { title: string; organizer: string; date: string };

export type LogoState = {
  url: string | null;
  pending: File | null | "remove";
  onChange: (next: File | null | "remove") => void;
};

/**
 * Pending logo change plus an object URL for the preview. The URL is created in the setter (not an
 * effect) and revoked when replaced or on unmount.
 */
export function usePendingLogo() {
  const [state, setState] = useState<{ pending: LogoState["pending"]; objectUrl: string | null }>({
    pending: null,
    objectUrl: null,
  });
  const urlRef = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );
  const setPending = useCallback((next: LogoState["pending"]) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next instanceof File ? URL.createObjectURL(next) : null;
    setState({ pending: next, objectUrl: urlRef.current });
  }, []);
  return { pending: state.pending, objectUrl: state.objectUrl, setPending };
}

const placeholder = <div className="aspect-[300/430] w-full rounded-md bg-[#090a0c]" />;

type PreviewProps = {
  template: BadgeTemplate;
  accent: string;
  logoUrl: string | null;
  preview: PreviewEvent;
};

export function TemplatePreview({ template, accent, logoUrl, preview }: PreviewProps) {
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

  return (
    <div className="mx-auto w-full max-w-xs">
      <ClientOnly fallback={placeholder}>
        <Suspense fallback={placeholder}>
          <HoloBadge template={template} accent={accent} data={data} logoUrl={logoUrl} />
        </Suspense>
      </ClientOnly>
    </div>
  );
}

type Props = {
  template: BadgeTemplate;
  accent: string;
  onTemplateChange: (t: BadgeTemplate) => void;
  /** Fires on the color input's `change` (picker closed), not on every drag. */
  onAccentChange: (accent: string) => void;
  logo: LogoState;
};

export function TemplatePicker({
  template,
  accent,
  onTemplateChange,
  onAccentChange,
  logo,
}: Props) {
  const colorRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  // Each accent change re-uploads the shader mask, so only commit once the picker settles.
  const onAccentRef = useRef(onAccentChange);
  useEffect(() => {
    onAccentRef.current = onAccentChange;
  });
  const colorInputRef = useCallback((el: HTMLInputElement | null) => {
    colorRef.current = el;
    const detach = commitOnChange<HTMLInputElement>((v) => onAccentRef.current(v))(el);
    return () => {
      colorRef.current = null;
      detach?.();
    };
  }, []);
  useEffect(() => {
    if (colorRef.current) colorRef.current.value = accent;
  }, [accent]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      // Validate now so a bad image fails here, not after the event has been saved.
      const png = await rasterizeLogo(file);
      logo.onChange(new File([png], "logo.png", { type: "image/png" }));
    } catch (err) {
      toast.error(
        err instanceof LogoTooLargeError
          ? "That logo is too large even after resizing. Try a simpler image."
          : "Couldn't read that logo. Try a PNG, JPG or SVG.",
      );
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const hasLogo = logo.pending instanceof File || (logo.pending !== "remove" && !!logo.url);

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Badge template" className="grid gap-2 sm:grid-cols-3">
        {BADGE_TEMPLATES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={template === t}
            onClick={() => onTemplateChange(t)}
            className={cn(
              "flex flex-col gap-1 rounded-lg border p-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
              template === t ? "border-primary ring-1 ring-primary" : "hover:border-foreground/40",
            )}
          >
            <span className="font-medium">{OPTIONS[t].label}</span>
            <span className="text-xs text-muted-foreground">{OPTIONS[t].description}</span>
          </button>
        ))}
      </div>

      {template === "branded" && (
        <div className="flex flex-col gap-4 rounded-lg border p-3">
          <label className="flex items-center gap-3 text-sm font-medium">
            Accent color
            <input
              ref={colorInputRef}
              type="color"
              defaultValue={accent}
              className="h-8 w-12 cursor-pointer rounded border bg-transparent"
            />
          </label>
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
            {hasLogo && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => logo.onChange("remove")}
              >
                Remove logo
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
