import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PublicEvent } from "@/server/events";
import { formatEventDate } from "@/lib/format";

type CertificateCardProps = {
  attendee: { id: string; firstName: string; lastName: string };
  event: Pick<PublicEvent, "title" | "organizer" | "date">;
  /** When set, the certificate ID becomes a button that triggers it. */
  onCopyLink?: () => void;
};

export function CertificateCard({ attendee, event, onCopyLink }: CertificateCardProps) {
  return (
    <Card className="relative max-w-screen-sm gap-0 overflow-hidden border-none bg-foreground py-0 text-background ring-0">
      <div className="absolute top-1/2 -left-10 hidden size-16 -translate-y-1/2 rounded-full bg-background sm:block" />
      <div className="absolute top-1/2 -right-10 size-16 -translate-y-1/2 rounded-full bg-background" />
      <CardContent className="flex flex-col px-0 py-0 sm:flex-row sm:px-16">
        <div className="flex flex-col gap-12 px-10 py-10 sm:px-0">
          <h3 className="text-4xl font-bold tracking-tighter break-words">
            {attendee.firstName} {attendee.lastName}
          </h3>
          <div>
            <p>
              Has successfully participated in <span className="font-medium">{event.title}</span> by{" "}
              {event.organizer} held on {formatEventDate(event.date)}.
            </p>
            <p className="mt-7 text-xs opacity-60">
              Powered by <span className="font-medium">OMSIMOS</span>
            </p>
          </div>
        </div>
        <div className="relative flex justify-center border-t-2 border-dotted py-10 text-lg sm:ml-10 sm:border-t-0 sm:border-l-2 sm:pb-0 sm:pl-10 sm:text-xl">
          {onCopyLink ? (
            <Tooltip>
              <TooltipTrigger
                render={<button type="button" />}
                onClick={onCopyLink}
                className="cursor-pointer text-left sm:w-7 sm:text-center sm:[writing-mode:vertical-rl]"
              >
                {attendee.id}
              </TooltipTrigger>
              <TooltipContent>Copy link to clipboard</TooltipContent>
            </Tooltip>
          ) : (
            <span className="sm:w-7 sm:text-center sm:[writing-mode:vertical-rl]">
              {attendee.id}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
