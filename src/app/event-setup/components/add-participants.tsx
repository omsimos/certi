"use client";

import React, { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { z } from "zod";
import { Attendee } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { db } from "@/config/firebase";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useParams } from "next/navigation";
import { Input } from "@/components/ui/input";

export default function AddParticipants() {
  const [attendees, setAttendees] = useState("");
  const [parsedAttendees, setParsedAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(false);

  const params = useParams<{ name: string }>();

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

  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");

  const handleLogin: React.FormEventHandler = (e) => {
    e.preventDefault();

    if (password === process.env.NEXT_PUBLIC_PASSWORD) {
      setAuthorized(true);
      toast.success("Login successful");
    } else {
      toast.error("Incorrect password");
    }
  };

  if (!authorized) {
    return (
      <form onSubmit={handleLogin}>
        <div className="flex gap-3">
          <Input
            required
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className=""
          />
          <Button type="submit">Login</Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          This service is currently on closed beta.
        </p>
      </form>
    );
  }

  return (
    <div className="relative z-10">
      <form className="mx-auto flex max-w-screen-sm flex-col">
        <div>
          <div>
            <h3 className="text-lg font-medium">Import Participants</h3>
            <p className="text-sm text-muted-foreground">
              Make sure to follow the same JSON Format
            </p>
            <Separator className="my-5" />
          </div>
          <Textarea
            placeholder="Paste JSON"
            className="max-h-[350px] min-h-[150px]"
            value={attendees}
            onChange={(e) => setAttendees(e.target.value)}
          />
        </div>

        <Button
          disabled={loading}
          type="button"
          className="mt-4"
          onClick={handleParse}
        >
          Parse Data
        </Button>

        <p className="mt-8 text-sm text-muted-foreground">Sample JSON</p>
        <pre className="bg-bg my-4 rounded border px-8 py-4 text-orange-600 dark:text-yellow-500">
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
              onClick={handleImport}
            >
              Import Certificates
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
