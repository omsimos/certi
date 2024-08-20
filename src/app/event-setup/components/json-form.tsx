"use client";

import { z } from "zod";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import React, { useState } from "react";
import { Attendee } from "@/lib/types";

import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/icons";

export default function JsonForm() {
  const [attendees, setAttendees] = useState("");
  const [parsedAttendees, setParsedAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(false);
  const [openAdminModal, setAdminModal] = useState(false);

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
    } catch {
      toast.error("Invalid JSON format");
    }
    setLoading(false);
  };

  return (
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

      {parsedAttendees.length > 0 && (
        <div className="mt-8">
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

          <Button
            disabled={loading}
            type="button"
            className="mt-4 w-full"
            onClick={() => setAdminModal(!openAdminModal)}
          >
            {!loading ? "Import Certificates" : <Icons.spinner />}
          </Button>
        </div>
      )}
    </form>
  );
}
