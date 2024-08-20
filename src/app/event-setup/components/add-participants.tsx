"use client";

import React from "react";
import JsonForm from "./json-form";
import { XlsxForm } from "./xlsx-form";
import ImportParticipantsDialog from "./import-participants-dialog";

export default function AddParticipants() {
  return (
    <div className="relative z-10 flex flex-col gap-16">
      <ImportParticipantsDialog />
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
