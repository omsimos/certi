// Maintainer script: finds out whether Resend counts a scheduled email against the daily
// cap when it is scheduled or when it is sent. Needs a real account; never run in CI.
//   RESEND_API_KEY=... RESEND_FROM=... bun scripts/resend-cap-probe.ts
import { createEmailClient, type OutgoingEmail } from "../src/server/email/client";

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

const client = createEmailClient({ mode: "resend", apiKey });
const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const accepted: string[] = [];
const rejections: string[] = [];

try {
  for (let start = 0; start < total; start += BATCH_SIZE) {
    const count = Math.min(BATCH_SIZE, total - start);
    const emails: OutgoingEmail[] = Array.from({ length: count }, (_, i) => ({
      from,
      to: "delivered@resend.dev",
      subject: `certi cap probe ${start + i + 1}/${total}`,
      html: "<p>certi cap probe. Safe to ignore.</p>",
      text: "certi cap probe. Safe to ignore.",
      scheduledAt,
    }));
    const results = await client.sendBatch(emails, `certi-cap-probe-${crypto.randomUUID()}`);
    for (const r of results) {
      if (r.ok) accepted.push(r.id);
      else rejections.push(r.error);
    }
  }
} finally {
  // Always cancel, even after a failure, so nothing is left to send tomorrow.
  let failed = 0;
  for (const id of accepted) {
    try {
      await client.cancel(id);
    } catch {
      failed++;
    }
  }
  console.log(
    `accepted ${accepted.length}, rejected ${rejections.length}, cancelled ${accepted.length - failed}`,
  );
  if (failed > 0)
    console.error(
      `${failed} accepted emails could not be cancelled; cancel them in the Resend dashboard.`,
    );
}

const unique = [...new Set(rejections)];
if (unique.length) console.log(`rejection messages: ${unique.join(" | ")}`);

if (rejections.some((m) => /quota|daily|limit|rate/i.test(m) && !/scheduled_at/i.test(m))) {
  console.log("counts at schedule time");
} else if (rejections.length === 0) {
  console.log("counts at send time");
} else if (rejections.every((m) => /scheduled_at|schedul/i.test(m))) {
  console.log("batch scheduled_at unsupported");
} else {
  console.log("inconclusive: unrecognised rejection, read the messages above");
  process.exitCode = 2;
}
