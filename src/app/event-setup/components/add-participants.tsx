"use client";

import { toast } from "sonner";
import { nanoid } from "nanoid";
import React, { useState } from "react";
import { db } from "@/config/firebase";
import { Attendee } from "@/lib/types";
import { doc, setDoc } from "firebase/firestore";

import AdminPermDialog from "./admin-perm-dialog";
import { useParams } from "next/navigation";
import { XlsxForm } from "./xlsx-form";
import JsonForm from "./json-form";

export default function AddParticipants() {
  const [attendees, setAttendees] = useState("");
  const [parsedAttendees, setParsedAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(false);
  const [openAdminModal, setAdminModal] = useState(false);

  const params = useParams<{ name: string }>();

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
        setAttendees("");
      }, 500);

      toast.success("Certificates added");
    } catch (err: any) {
      toast.error(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="relative z-10 flex flex-col gap-16">
      <AdminPermDialog
        openAdminModal={openAdminModal}
        setAdminModal={setAdminModal}
        handleSubmit={handleImport}
      />
      <XlsxForm />
      <div className="flex items-center gap-3 text-center text-muted-foreground">
        <div className="h-px w-full bg-muted" />
        <span>or</span>
        <div className="h-px w-full bg-muted" />
      </div>
      <JsonForm />
    </div>
  );
}
