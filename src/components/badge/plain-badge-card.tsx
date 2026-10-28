import type { BadgeCardData } from "@/lib/badge/layout";
import { cn } from "@/lib/utils";

// Shown when the badge can't be drawn at all, so the attendee still sees their badge.
export function PlainBadgeCard({ data, className }: { data: BadgeCardData; className?: string }) {
  return (
    <div
      data-backend="plain"
      className={cn(
        "flex aspect-[300/430] w-full flex-col justify-between rounded-xl border border-[#4a5260] bg-[#101114] p-8 text-[#c4c9d1]",
        className,
      )}
    >
      <p className="font-mono text-xs tracking-widest uppercase">{data.organizer}</p>
      <div className="flex flex-col gap-3">
        <p className="text-3xl leading-tight font-semibold break-words">
          {data.firstName} {data.lastName}
        </p>
        <p className="text-base">{data.eventTitle}</p>
      </div>
      <p className="font-mono text-xs tracking-widest uppercase">{data.date}</p>
    </div>
  );
}
