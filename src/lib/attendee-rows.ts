import { attendeeInputSchema, MAX_ATTENDEES_PER_IMPORT, type AttendeeInput } from "./schemas";

// Pure and import-light on purpose: the client parses spreadsheets with this,
// so it must not pull in drizzle or Workers bindings.

export type AttendeeRowError = { row: number; message: string };
export type ParsedAttendees = {
  attendees: AttendeeInput[];
  errors: AttendeeRowError[];
  duplicates: number;
};

const HEADER_FIELDS: Record<string, keyof AttendeeInput> = {
  firstname: "firstName",
  first: "firstName",
  lastname: "lastName",
  last: "lastName",
  surname: "lastName",
  email: "email",
  emailaddress: "email",
  mail: "email",
};

function cellText(v: unknown): string {
  return typeof v === "string" || typeof v === "number" ? String(v).trim() : "";
}

function mapRow(row: unknown): Record<keyof AttendeeInput, string> {
  const out = { firstName: "", lastName: "", email: "" };
  if (typeof row !== "object" || row === null) return out;
  for (const [header, value] of Object.entries(row)) {
    const field = HEADER_FIELDS[header.toLowerCase().replace(/[^a-z0-9]/g, "")];
    // The first non-empty column wins when several headers map to one field.
    if (field && !out[field]) out[field] = cellText(value);
  }
  return out;
}

export function parseAttendeeRows(rows: unknown[]): ParsedAttendees {
  if (rows.length > MAX_ATTENDEES_PER_IMPORT) {
    return {
      attendees: [],
      errors: [{ row: 0, message: `Too many rows (max ${MAX_ATTENDEES_PER_IMPORT})` }],
      duplicates: 0,
    };
  }

  const attendees: AttendeeInput[] = [];
  const errors: AttendeeRowError[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  rows.forEach((raw, i) => {
    const mapped = mapRow(raw);
    if (!mapped.firstName && !mapped.lastName && !mapped.email) return;

    const result = attendeeInputSchema.safeParse(mapped);
    if (!result.success) {
      errors.push({ row: i + 1, message: result.error.issues[0].message });
      return;
    }
    if (seen.has(result.data.email)) {
      duplicates += 1;
      return;
    }
    seen.add(result.data.email);
    attendees.push(result.data);
  });

  return { attendees, errors, duplicates };
}
