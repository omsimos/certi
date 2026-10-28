// Maintainer script: finds out whether Resend counts a scheduled email against the daily
// cap when it is scheduled or when it is sent. Needs a real account; never run in CI.
//   RESEND_API_KEY=... RESEND_FROM=... bun scripts/resend-cap-probe.ts
import {
  createEmailClient,
  type OutgoingEmail,
  type SendResult,
  UNKNOWN_RESEND_ID,
} from "../src/server/email/client";

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM;
if (!apiKey || !from) {
  console.error("Set RESEND_API_KEY and RESEND_FROM (and optionally RESEND_DAILY_LIMIT).");
  process.exit(1);
}
const rawLimit = process.env.RESEND_DAILY_LIMIT ?? "100";
if (!/^\d+$/.test(rawLimit)) {
  console.error("RESEND_DAILY_LIMIT must be a non-negative integer.");
  process.exit(1);
}
const total = Number(rawLimit) + 1;
const BATCH_SIZE = 100;
// Resend allows 2 API requests per second by default.
const CANCEL_GAP_MS = 500;
const RETRY_AFTER_MS = 1500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Wraps fetch to print the first raw batch response (its permissive-mode shape is
// undocumented, see mapBatchResponse) and to tell a 429 apart from other failures.
let lastStatus = 0;
let printedBatch = false;
const probeFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  lastStatus = res.status;
  if (!printedBatch && String(input).endsWith("/emails/batch")) {
    printedBatch = true;
    console.log(`raw batch response (${res.status}): ${await res.clone().text()}`);
  }
  return res;
};

const client = createEmailClient({ mode: "resend", apiKey, fetch: probeFetch });

// Retries once on a rate limit; any other refusal is left for the dashboard.
async function cancelWithRetry(id: string): Promise<boolean> {
  try {
    await client.cancel(id);
    return true;
  } catch {
    if (lastStatus !== 429) return false;
  }
  await sleep(RETRY_AFTER_MS);
  return client.cancel(id).then(
    () => true,
    () => false,
  );
}
const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const email = (to: string, subject: string): OutgoingEmail => ({
  from,
  to,
  subject,
  html: "<p>certi cap probe. Safe to ignore.</p>",
  text: "certi cap probe. Safe to ignore.",
  scheduledAt,
});

// The first email is deliberately invalid, so the raw response shows how permissive
// mode reports a rejection next to the accepted ones.
const emails = [
  email("not-an-email", "certi cap probe: invalid recipient"),
  ...Array.from({ length: total }, (_, i) =>
    email("delivered@resend.dev", `certi cap probe ${i + 1}/${total}`),
  ),
];
const accepted: string[] = [];
const rejections: string[] = [];
let invalid: SendResult | undefined;
let unknownIds = 0;

try {
  for (let start = 0; start < emails.length; start += BATCH_SIZE) {
    const batch = emails.slice(start, start + BATCH_SIZE);
    const results = await client.sendBatch(batch, `certi-cap-probe-${crypto.randomUUID()}`);
    results.forEach((r, i) => {
      if (start + i === 0) invalid = r;
      if (r.ok && r.id === UNKNOWN_RESEND_ID) unknownIds++;
      else if (r.ok) accepted.push(r.id);
      else if (start + i > 0) rejections.push(r.error);
    });
  }
} finally {
  // Always cancel, even after a failure, so nothing is left to send tomorrow.
  let failed = 0;
  for (const [n, id] of accepted.entries()) {
    if (n > 0) await sleep(CANCEL_GAP_MS);
    if (!(await cancelWithRetry(id))) failed++;
  }
  console.log(
    `accepted ${accepted.length}, rejected ${rejections.length}, cancelled ${accepted.length - failed}`,
  );
  if (failed > 0)
    console.error(
      `${failed} accepted emails could not be cancelled; cancel them in the Resend dashboard.`,
    );
  if (unknownIds > 0)
    console.error(
      `The batch response didn't match the expected shape, so ${unknownIds} emails have no id to cancel. Cancel them in the Resend dashboard and read the raw response above.`,
    );
}

console.log(
  `invalid recipient: ${invalid?.ok === false ? `rejected (${invalid.error})` : "not rejected; read the raw response above"}`,
);
const unique = [...new Set(rejections)];
if (unique.length) console.log(`rejection messages: ${unique.join(" | ")}`);

// Not a bare "rate" or "limit": a 429 rate-limit message says nothing about the daily cap.
const isQuota = (m: string) =>
  /quota|daily (sending )?limit|too many emails/i.test(m) &&
  !/rate limit|too many requests/i.test(m);

if (rejections.some((m) => isQuota(m) && !/scheduled_at/i.test(m))) {
  console.log("counts at schedule time");
} else if (rejections.length === 0) {
  console.log("counts at send time");
} else if (rejections.every((m) => /scheduled_at|schedul/i.test(m))) {
  console.log("batch scheduled_at unsupported");
} else {
  console.log("inconclusive: unrecognised rejection, read the messages above");
  process.exitCode = 2;
}
