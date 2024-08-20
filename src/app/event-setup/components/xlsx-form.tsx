"use client";

import { z } from "zod";
import * as xlsx from "xlsx";
import { toast } from "sonner";
import { ChangeEvent, useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Attendee } from "@/lib/types";
import { useAttendeesStore } from "@/hooks/use-attendees-store";
import { useDialogStore } from "@/hooks/use-dialog-store";
import { Icons } from "@/components/icons";

export function XlsxForm() {
  const [loading, setLoading] = useState(false);

  const { setParsedAttendees } = useAttendeesStore();
  const { setImportDialog } = useDialogStore();

  const handleParse = (e: ChangeEvent<HTMLInputElement>) => {
    setLoading(true);
    const schema = z.object({
      firstName: z.string(),
      lastName: z.string(),
      email: z.string(),
    });

    e.preventDefault();

    try {
      if (e.target.files) {
        const reader = new FileReader();
        let invalid = false;

        reader.onload = (e) => {
          const data = e.target!.result;
          const workbook = xlsx.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const attendeeJson = xlsx.utils.sheet_to_json(worksheet);

          const _parsedAttendees = attendeeJson as Attendee[];
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
          setParsedAttendees(_parsedAttendees);
          setImportDialog(true);
        };
        reader.readAsArrayBuffer(e.target.files[0]);
      }
    } catch {
      toast.error("Invalid JSON format");
    }

    setLoading(false);
  };

  return (
    <form className="grid w-full max-w-md items-center gap-5">
      <div>
        <h3 className="text-lg font-medium">
          Import Participants via .xlsx file
        </h3>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-destructive">Strict:</span> Make
          sure to follow the same Excel Format
        </p>
      </div>

      <Separator />

      <p className="text-sm text-muted-foreground">Sample Excel</p>
      <TableDemo />
      <div className="relative">
        <Input
          id="picture"
          type="file"
          className="w-full cursor-pointer bg-muted/30"
          onChange={(e) => handleParse(e)}
        />
        {loading && (
          <Icons.spinner className="absolute right-4 top-1/2 -translate-y-1/2" />
        )}
      </div>
    </form>
  );
}

const placeholder = [
  {
    firstName: "John",
    lastName: "Doe",
    email: "john@doe.com",
  },
  {
    firstName: "Sally",
    lastName: "Smith",
    email: "sally@smith.com",
  },
];

export function TableDemo() {
  return (
    <Table className="border">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">firstName</TableHead>
          <TableHead>lastName</TableHead>
          <TableHead>email</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {placeholder.map((data) => (
          <TableRow key={data.email}>
            <TableCell>{data.firstName}</TableCell>
            <TableCell>{data.lastName}</TableCell>
            <TableCell>{data.email}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
