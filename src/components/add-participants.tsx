import { useRouter } from "@tanstack/react-router";
import { useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { parseAttendeeRows, type ParsedAttendees } from "@/lib/attendee-rows";
import { hasErrorName } from "@/lib/errors";
import { importAttendeesFn } from "@/server/fns";

const PREVIEW_ROWS = 50;
const MAX_ERROR_LINES = 20;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const JSON_SAMPLE = `[
  { "firstName": "John", "lastName": "Doe", "email": "john@doe.com" },
  { "firstName": "Sally", "lastName": "Smith", "email": "sally@smith.com" }
]`;

const SAMPLE_ROWS = [
  ["John", "Doe", "john@doe.com"],
  ["Sally", "Smith", "sally@smith.com"],
];

export function AddParticipants({ code }: { code: string }) {
  const router = useRouter();
  const [parsed, setParsed] = useState<ParsedAttendees | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [json, setJson] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  function showParsed(result: ParsedAttendees) {
    setParsed(result);
    if (result.attendees.length > 0) {
      setPreviewOpen(true);
    } else if (result.errors.length === 0) {
      toast.error("No participants found");
    }
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setParsing(true);
    try {
      if (file.size > MAX_FILE_BYTES) {
        toast.error("That file is too large (max 5 MB)");
        return;
      }
      // Loaded on demand so the spreadsheet parser stays out of the main bundle.
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) {
        toast.error("That spreadsheet has no sheets");
        return;
      }
      showParsed(parseAttendeeRows(XLSX.utils.sheet_to_json(sheet, { defval: "" })));
    } catch {
      toast.error("Could not read that file. Is it a valid .xlsx?");
    } finally {
      // Lets the same file be picked again after fixing it.
      input.value = "";
      setParsing(false);
    }
  }

  function handleJson() {
    let value: unknown;
    try {
      value = JSON.parse(json);
    } catch {
      toast.error("Invalid JSON format");
      return;
    }
    if (!Array.isArray(value)) {
      toast.error("Expected a JSON array of participants");
      return;
    }
    showParsed(parseAttendeeRows(value));
  }

  async function handleImport() {
    if (!parsed || parsed.attendees.length === 0) return;
    setImporting(true);
    try {
      const { inserted, skipped } = await importAttendeesFn({
        data: { code, attendees: parsed.attendees },
      });
      toast.success(`${inserted} added, ${skipped} already existed`);
      setPreviewOpen(false);
      setParsed(null);
      setJson("");
      await router.invalidate();
    } catch (err) {
      toast.error(
        hasErrorName(err, "ForbiddenError", "NotFoundError")
          ? "You can't change this event"
          : "Something went wrong. Please try again.",
      );
    } finally {
      setImporting(false);
    }
  }

  const errors = parsed?.errors ?? [];
  const attendees = parsed?.attendees ?? [];

  return (
    <section className="flex flex-col gap-8">
      <div className="grid gap-10 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-medium">Import from .xlsx</h2>
            <p className="text-sm text-muted-foreground">
              Use a header row with <span className="font-medium">First Name</span>,{" "}
              <span className="font-medium">Last Name</span> and{" "}
              <span className="font-medium">Email</span>.
            </p>
          </div>
          <Table className="border">
            <TableHeader>
              <TableRow>
                <TableHead>First Name</TableHead>
                <TableHead>Last Name</TableHead>
                <TableHead>Email</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_ROWS.map((row) => (
                <TableRow key={row[2]}>
                  {row.map((cell) => (
                    <TableCell key={cell} className="text-muted-foreground">
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            aria-label="Upload .xlsx file"
            disabled={parsing}
            onChange={handleFile}
            className="h-9 cursor-pointer"
          />
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-medium">Or paste JSON</h2>
            <p className="text-sm text-muted-foreground">An array of participants.</p>
          </div>
          <pre className="overflow-x-auto rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <code>{JSON_SAMPLE}</code>
          </pre>
          <Textarea
            placeholder="Paste JSON"
            aria-label="Participants JSON"
            className="max-h-[300px] min-h-[120px] font-mono text-xs"
            value={json}
            onChange={(e) => setJson(e.target.value)}
          />
          <Button type="button" disabled={json.trim() === ""} onClick={handleJson}>
            Parse data
          </Button>
        </div>
      </div>

      {errors.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <p className="font-medium text-destructive">
            {errors.length} {errors.length === 1 ? "problem" : "problems"} found
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-destructive">
            {errors.slice(0, MAX_ERROR_LINES).map((e) => (
              <li key={`${e.row}-${e.message}`}>
                {e.row === 0 ? e.message : `Row ${e.row}: ${e.message}`}
              </li>
            ))}
            {errors.length > MAX_ERROR_LINES && (
              <li>&hellip;and {errors.length - MAX_ERROR_LINES} more</li>
            )}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Row numbers count participants, not the header row.
          </p>
        </div>
      )}

      {parsed && parsed.duplicates > 0 && (
        <p className="text-sm text-muted-foreground">
          {parsed.duplicates} duplicate {parsed.duplicates === 1 ? "email" : "emails"} in the input{" "}
          {parsed.duplicates === 1 ? "was" : "were"} skipped.
        </p>
      )}

      <Separator />

      <Dialog open={previewOpen} onOpenChange={(open) => !importing && setPreviewOpen(open)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Import participants</DialogTitle>
            <DialogDescription>
              {attendees.length} {attendees.length === 1 ? "participant" : "participants"} will be
              added. Anyone already in this event is skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendees.slice(0, PREVIEW_ROWS).map((a) => (
                  <TableRow key={a.email}>
                    <TableCell>
                      {a.firstName} {a.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{a.email}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {attendees.length > PREVIEW_ROWS && (
              <p className="border-t px-3 py-2 text-sm text-muted-foreground">
                &hellip;and {attendees.length - PREVIEW_ROWS} more
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={importing} onClick={() => setPreviewOpen(false)}>
              Cancel
            </Button>
            <Button disabled={importing} onClick={handleImport}>
              {importing ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
