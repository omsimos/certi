"use client";

import { useEffect, useState } from "react";
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

export default function BrowserWarn() {
  const [warnModal, setWarnModal] = useState(false);

  useEffect(() => {
    if (navigator.userAgent.match(/FBAN|FBAV/i)) {
      setWarnModal(true);
    }
  }, []);

  return (
    <AlertDialog open={warnModal} onOpenChange={setWarnModal}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>In-app browser detected</AlertDialogTitle>
          <AlertDialogDescription>
            To avoid running into issues, we recommend opening the certificate
            generator in an external browser.
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
