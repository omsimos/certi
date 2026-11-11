import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { inAppBrowserName } from "@/lib/in-app-browser";

export function BrowserWarn() {
  // Server snapshot is null so hydration matches; the client reads the user agent after.
  const name = useSyncExternalStore(
    () => () => {},
    () => inAppBrowserName(navigator.userAgent),
    () => null,
  );
  const [dismissed, setDismissed] = useState(false);
  const [, copy] = useCopyToClipboard();

  if (!name || dismissed) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 p-4 backdrop-blur"
    >
      <p className="text-sm">
        You're in {name}'s browser. Your badge looks and saves best in your phone's browser.
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={async () => {
            if (await copy(location.href)) {
              toast.success("Link copied — paste it into Safari or Chrome");
            } else {
              toast.error("Could not copy the link");
            }
          }}
        >
          Copy link
        </Button>
        <Button size="sm" variant="ghost" aria-label="Dismiss" onClick={() => setDismissed(true)}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
