"use client";

import { z } from "zod";
import { toast } from "sonner";
import React, { useState } from "react";
import { Attendee } from "@/lib/types";

import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useDialogStore } from "@/hooks/use-dialog-store";
import { useAttendeesStore } from "@/hooks/use-attendees-store";

export default function JsonForm() {
  const [attendees, setAttendees] = useState("");
  const [loading, setLoading] = useState(false);

  const { setParsedAttendees } = useAttendeesStore();
  const { setImportDialog } = useDialogStore();

  const handleParse = () => {
    setLoading(true);
    const schema = z.object({
      firstName: z.string(),
      lastName: z.string(),
      email: z.string(),
    });

    try {
      let invalid = false;
      const _parsedAttendees: Attendee[] = JSON.parse(attendees);
      _parsedAttendees.forEach((m, i) => {
        const data = schema.safeParse(m);
        if (!data.success) {
          toast.error("Contains invalid data");
          console.log(i, data.error, m);
          invalid = true;
          return;
        }
      });

      setLoading(false);
      if (invalid) return;

      toast.success("Parsed successfully");
      setParsedAttendees(_parsedAttendees);
      setImportDialog(true);
    } catch {
      toast.error("Invalid JSON format");
    }
    setLoading(false);
  };

  return (
    <>
      <form className="mx-auto flex w-full max-w-screen-sm">
        <div className="flex w-full flex-col gap-5">
          <div>
            <h3 className="text-lg font-medium">Import via JSON</h3>
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-destructive">Strict: </span>
              Make sure to follow the same JSON Format
            </p>
          </div>
          <Separator />
          <p className="text-sm text-muted-foreground">Sample JSON</p>
          <pre className="bg-bg rounded border px-8 py-4 text-orange-600 dark:text-yellow-500">
            <code>
              {`[
  {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@doe.com"
  },
  {
    "firstName": "Sally",
    "lastName": "Smith",
    "email": "sally@smith.com"
  }
]`}
            </code>
          </pre>

          <div>
            <Textarea
              placeholder="Paste JSON"
              className="max-h-[350px] min-h-[150px]"
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
            />

            <Button
              disabled={loading}
              type="button"
              className="mt-2 w-full"
              onClick={handleParse}
            >
              Parse Data
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
