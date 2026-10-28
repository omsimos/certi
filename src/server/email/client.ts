export type OutgoingEmail = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  scheduledAt?: string;
};

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

// Stands in for the id of an email Resend accepted that we couldn't match to its request.
// It can't be cancelled, and unlike null it doesn't read as an unsent claim to be re-sent.
export const UNKNOWN_RESEND_ID = "unknown";

export type EmailClient = {
  // Index-aligned with `emails`.
  sendBatch(emails: OutgoingEmail[], idempotencyKey: string): Promise<SendResult[]>;
  cancel(id: string): Promise<void>;
};

// Log mode's outbox, for dev and tests. Module-level, so it is shared per isolate.
export const emailLog: { batches: OutgoingEmail[][]; cancelled: string[] } = {
  batches: [],
  cancelled: [],
};

export function clearEmailLog(): void {
  emailLog.batches.length = 0;
  emailLog.cancelled.length = 0;
}

const RESEND_API = "https://api.resend.com";

function createLogClient(): EmailClient {
  return {
    async sendBatch(emails) {
      emailLog.batches.push(emails.map((e) => ({ ...e })));
      return emails.map(() => ({ ok: true, id: `log_${crypto.randomUUID()}` }));
    },
    async cancel(id) {
      emailLog.cancelled.push(id);
    },
  };
}

async function errorMessage(res: Response): Promise<string> {
  const body: unknown = await res.json().catch(() => null);
  if (body && typeof body === "object" && "message" in body && typeof body.message === "string") {
    return body.message;
  }
  return `Resend responded ${res.status}`;
}

type BatchResponse = {
  data?: { id: string }[];
  errors?: { index: number; message: string }[];
};

// Permissive validation lists only the created emails in `data`, in request order,
// and the rejected ones by request index in `errors`. That shape is undocumented, so
// anything else is treated as all accepted: guessing could put one attendee's id on
// another (and cancel the wrong email later), and marking them failed would re-send.
function mapBatchResponse(count: number, body: BatchResponse): SendResult[] {
  const data = body.data ?? [];
  const rawErrors = body.errors ?? [];
  const errors = new Map(rawErrors.map((e) => [e.index, e.message]));
  const compacted =
    errors.size === rawErrors.length &&
    data.length === count - errors.size &&
    [...errors.keys()].every((i) => Number.isInteger(i) && i >= 0 && i < count);
  if (!compacted) {
    console.error("Unexpected Resend batch response shape", {
      count,
      ids: data.length,
      errorIndexes: rawErrors.map((e) => e.index),
    });
    return Array.from({ length: count }, (): SendResult => ({ ok: true, id: UNKNOWN_RESEND_ID }));
  }
  let next = 0;
  return Array.from({ length: count }, (_, i): SendResult => {
    const error = errors.get(i);
    if (error !== undefined) return { ok: false, error };
    const id = data[next++]?.id;
    return id ? { ok: true, id } : { ok: false, error: "Resend returned no email id" };
  });
}

function createResendClient(apiKey: string, doFetch: typeof fetch): EmailClient {
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  return {
    async sendBatch(emails, idempotencyKey) {
      const failAll = (error: string) => emails.map((): SendResult => ({ ok: false, error }));
      let res: Response;
      try {
        res = await doFetch(`${RESEND_API}/emails/batch`, {
          method: "POST",
          headers: {
            ...headers,
            "Idempotency-Key": idempotencyKey,
            // Strict mode rejects the whole batch for one bad address.
            "x-batch-validation": "permissive",
          },
          body: JSON.stringify(
            emails.map((e) => ({
              from: e.from,
              to: [e.to],
              subject: e.subject,
              html: e.html,
              text: e.text,
              ...(e.scheduledAt ? { scheduled_at: e.scheduledAt } : {}),
            })),
          ),
        });
      } catch (err) {
        return failAll(err instanceof Error ? err.message : String(err));
      }
      if (!res.ok) return failAll(await errorMessage(res));
      const body = (await res.json().catch(() => null)) as BatchResponse | null;
      if (!body) return failAll("Unreadable Resend response");
      return mapBatchResponse(emails.length, body);
    },

    async cancel(id) {
      const res = await doFetch(`${RESEND_API}/emails/${encodeURIComponent(id)}/cancel`, {
        method: "POST",
        headers,
      });
      if (!res.ok) throw new Error(await errorMessage(res));
    },
  };
}

export function createEmailClient(cfg: {
  mode: "log" | "resend";
  apiKey?: string;
  fetch?: typeof fetch;
}): EmailClient {
  if (cfg.mode === "log") return createLogClient();
  if (!cfg.apiKey) throw new Error("RESEND_API_KEY is not set");
  // A bare `fetch` reference called off another object throws "Illegal invocation" in workerd.
  return createResendClient(cfg.apiKey, cfg.fetch ?? ((input, init) => fetch(input, init)));
}
