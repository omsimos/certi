import { useState, useSyncExternalStore } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function BrowserWarn() {
  // Server snapshot is false so hydration matches; the client reads the user agent after.
  const isInApp = useSyncExternalStore(
    () => () => {},
    () => /FBAN|FBAV/i.test(navigator.userAgent),
    () => false,
  );
  const [dismissed, setDismissed] = useState(false);
  const warnModal = isInApp && !dismissed;

  return (
    <AlertDialog open={warnModal} onOpenChange={(open) => setDismissed(!open)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>In-app browser detected</AlertDialogTitle>
          <AlertDialogDescription>
            To avoid running into issues, we recommend opening the certificate generator in an
            external browser.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction>Understood</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
