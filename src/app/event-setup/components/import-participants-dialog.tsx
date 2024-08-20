"use client";

import { toast } from "sonner";
import { nanoid } from "nanoid";
import { db } from "@/config/firebase";
import React, { useState } from "react";
import { useParams } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";
import AdminPermDialog from "./admin-perm-dialog";
import { useAttendeesStore } from "@/hooks/use-attendees-store";

import { AlertDialog, AlertDialogContent } from "@/components/ui/alert-dialog";

import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useDialogStore } from "@/hooks/use-dialog-store";

export default function ImportParticipantsDialog() {
  const params = useParams<{ name: string }>();

  const [openAdminModal, setAdminModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const { importDialog, setImportDialog } = useDialogStore();
  const { parsedAttendees, setParsedAttendees } = useAttendeesStore();

  const handleImport = () => {
    setLoading(true);
    if (parsedAttendees.length === 0) {
      toast.error("No attendees to import");
      return;
    }

    try {
      parsedAttendees.forEach(async (attendee) => {
        try {
          await setDoc(
            doc(db, `${params.name}/data/certificates`, nanoid(10)),
            {
              firstName: attendee.firstName,
              lastName: attendee.lastName,
              email: attendee.email,
            },
          );
        } catch (err: any) {
          toast.error(err.message);
        }
      });

      setTimeout(() => {
        setParsedAttendees([]);
      }, 500);

      toast.success("Certificates added");
    } catch (err: any) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  const cancelImport = () => {
    setImportDialog(false);
    setParsedAttendees([]);
  };

  return (
    <>
      <AdminPermDialog
        openAdminModal={openAdminModal}
        setAdminModal={setAdminModal}
        handleSubmit={handleImport}
      />

      <AlertDialog open={importDialog} onOpenChange={setImportDialog}>
        <AlertDialogContent>
          {parsedAttendees.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">
                Total certificates to be added: {parsedAttendees.length}
              </p>
              <div className="mt-4 max-h-[300px] overflow-y-scroll rounded border px-6">
                {parsedAttendees.map((m) => {
                  return (
                    <div
                      key={nanoid()}
                      className="flex space-x-8 border-b py-6 text-sm last-of-type:border-b-0"
                    >
                      <div className="[&>*]:text-muted-foreground">
                        <p>Email:</p>
                        <p>First Name:</p>
                        <p>Last Name:</p>
                      </div>
                      <div>
                        <p>{m.email}</p>
                        <p>{m.firstName}</p>
                        <p>{m.lastName}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  disabled={loading}
                  type="button"
                  className="mt-4 w-full"
                  onClick={() => setAdminModal(!openAdminModal)}
                >
                  {!loading ? "Import Certificates" : <Icons.spinner />}
                </Button>
                <Button variant="outline" onClick={cancelImport}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
