import { ClientOnly } from "@tanstack/react-router";
import { lazy, type Ref, type RefObject, Suspense } from "react";

import type { HoloBadgeHandle } from "@/components/badge/holo-badge";
import type { BadgeCardData } from "@/lib/badge/layout";
import type { BadgeControl } from "@/lib/badge/pose";
import { type BadgeTemplate, DEFAULT_ACCENT } from "@/lib/badge/templates";
import { cn } from "@/lib/utils";

const HoloBadge = lazy(() =>
  import("@/components/badge/holo-badge").then((m) => ({ default: m.HoloBadge })),
);

export type DemoCard = Omit<BadgeCardData, "badgeUrl">;

export const demoCard = (firstName: string, lastName: string, attendeeId = "0042"): DemoCard => ({
  firstName,
  lastName,
  eventTitle: "Night Build 2026",
  organizer: "omsimos",
  date: "Nov 14 2026",
  attendeeId,
});

const placeholder = <div className="slot-ph" />;

type LandingBadgeProps = {
  template?: BadgeTemplate;
  accent?: string;
  data: DemoCard;
  interactive?: boolean;
  control?: RefObject<BadgeControl | null>;
  className?: string;
  ref?: Ref<HoloBadgeHandle>;
  onBackendChange?: (backend: HoloBadgeHandle["backend"]) => void;
};

export function LandingBadge({
  template = "graphite",
  accent = DEFAULT_ACCENT,
  data,
  interactive = true,
  control,
  className,
  ref,
  onBackendChange,
}: LandingBadgeProps) {
  return (
    <div className={cn("slot", className)}>
      <ClientOnly fallback={placeholder}>
        <Suspense fallback={placeholder}>
          <HoloBadge
            ref={ref}
            template={template}
            accent={accent}
            // Client-only, so the QR can point at whichever origin is serving the page.
            data={{ ...data, badgeUrl: window.location.origin }}
            interactive={interactive}
            control={control}
            onBackendChange={onBackendChange}
          />
        </Suspense>
      </ClientOnly>
    </div>
  );
}
