import { env } from "cloudflare:workers";
import { asc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { beforeEach, describe, expect, it } from "vitest";
import { getDb } from "../src/db";
import { attendee, event, type Event } from "../src/db/schema";
import { ForbiddenError } from "../src/lib/errors";
import {
  clearEmailLog,
  createEmailClient,
  emailLog,
  type EmailClient,
  type OutgoingEmail,
} from "../src/server/email/client";
import { readEmailConfig } from "../src/server/email/config";
import { sendBadges, type SendDeps } from "../src/server/email/send-badges";
import { DAY_MS } from "../src/server/email/slots";
import { createTestEvent, createTestUser } from "./helpers";

const db = getDb(env.DB);
const origin = "https://certi.test";

// Commitments are global across the shared test database, so every test gets its own
// "now" far enough from the others that their sends never share a 30-day window.
let clock = Date.UTC(2031, 0, 1);
const tick = () => new Date((clock += 100 * DAY_MS));

beforeEach(() => clearEmailLog());

// 10 columns x 9 rows = 90 parameters, under D1's 100.
const ROWS_PER_SEED = 9;

async function seed(opts: { images: number; without?: number; ownerId?: string }) {
  const ownerId = opts.ownerId ?? (await createTestUser(db)).id;
  const ev = await createTestEvent(db, ownerId);
  const total = opts.images + (opts.without ?? 0);
  const base = Date.UTC(2030, 0, 1);
  const rows = Array.from({ length: total }, (_, i) => {
    const id = nanoid(10);
    const image = i < opts.images;
    return {
      id,
      eventId: ev.id,
      firstName: `P${i}`,
      lastName: "L",
      email: `${id.toLowerCase()}@example.com`,
      createdAt: new Date(base + i),
      badgeImageKey: image ? `badges/v1/${id}/${ev.updatedAt.getTime()}.jpg` : null,
      badgeImageVersion: image ? ev.updatedAt : null,
    };
  });
  const inserts = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_SEED) {
    inserts.push(db.insert(attendee).values(rows.slice(i, i + ROWS_PER_SEED)));
  }
  if (inserts.length) await db.batch(inserts as [(typeof inserts)[number]]);
  return { ownerId, ev, ids: rows.map((r) => r.id), emails: rows.map((r) => r.email) };
}

function deps(now: Date, overrides: Partial<SendDeps> = {}): SendDeps {
  return {
    db,
    client: createEmailClient({ mode: "log" }),
    now,
    dailyLimit: 100,
    origin,
    from: "certi <badges@certi.test>",
    ...overrides,
  };
}

const rowsOf = (ev: Event) =>
  db
    .select()
    .from(attendee)
    .where(eq(attendee.eventId, ev.id))
    .orderBy(asc(attendee.createdAt), asc(attendee.id));

const loggedRecipients = () => emailLog.batches.flat().map((e) => e.to);

function countingClient(inner: EmailClient) {
  const calls = { batches: 0, cancels: 0 };
  const client: EmailClient = {
    sendBatch: (emails, key) => {
      calls.batches++;
      return inner.sendBatch(emails, key);
    },
    cancel: (id) => {
      calls.cancels++;
      return inner.cancel(id);
    },
  };
  return { client, calls };
}

describe("sendBadges", () => {
  it("sends today's share now, schedules the rest and skips rows without an image", async () => {
    const now = tick();
    const { ownerId, ev, ids, emails } = await seed({ images: 3, without: 1 });

    const summary = await sendBadges(deps(now, { dailyLimit: 2 }), ownerId, ev.code);

    const tomorrow = new Date(now.getTime() + DAY_MS);
    expect(summary).toEqual({
      sentNow: 2,
      scheduled: [{ at: tomorrow.toISOString(), count: 1 }],
      failed: 0,
      missingImage: 1,
      overflow: 0,
    });
    expect(emailLog.batches).toHaveLength(2);
    expect(emailLog.batches[0].map((e) => e.scheduledAt)).toEqual([undefined, undefined]);
    expect(emailLog.batches[1][0].scheduledAt).toBe(tomorrow.toISOString());
    expect(loggedRecipients()).toEqual(emails.slice(0, 3));

    const first = emailLog.batches[0][0];
    expect(first.from).toBe("certi <badges@certi.test>");
    expect(first.subject).toBe(`Your badge for ${ev.title}`);
    expect(first.html).toContain(
      `${origin}/api/badge/${ev.code}/${ids[0]}?v=${ev.updatedAt.getTime()}`,
    );
    expect(first.text).toContain(`${origin}/event/${ev.code}/badge/${ids[0]}`);

    const rows = await rowsOf(ev);
    expect(rows.map((r) => r.emailStatus)).toEqual(["sent", "sent", "scheduled", "not_sent"]);
    expect(rows[0].emailSentAt).toEqual(now);
    expect(rows[0].resendId).toBeTruthy();
    expect(rows[2].emailScheduledFor).toEqual(tomorrow);
    expect(rows[2].resendId).toBeTruthy();
    expect(rows[3].resendId).toBeNull();
  });

  it("schedules everything when today's quota is already used", async () => {
    const now = tick();
    const other = await seed({ images: 2 });
    await db
      .update(attendee)
      .set({ emailStatus: "sent", emailSentAt: now })
      .where(eq(attendee.eventId, other.ev.id));
    const mine = await seed({ images: 1 });

    const summary = await sendBadges(deps(now, { dailyLimit: 2 }), mine.ownerId, mine.ev.code);

    const tomorrow = new Date(now.getTime() + DAY_MS).toISOString();
    expect(summary.sentNow).toBe(0);
    expect(summary.scheduled).toEqual([{ at: tomorrow, count: 1 }]);
    expect(emailLog.batches[0][0].scheduledAt).toBe(tomorrow);
    expect((await rowsOf(mine.ev))[0].emailStatus).toBe("scheduled");
  });

  it("emails each attendee once when two sends race", async () => {
    const now = tick();
    const { ownerId, ev, emails } = await seed({ images: 5 });
    const d = deps(now, { dailyLimit: 2 });

    const [a, b] = await Promise.all([
      sendBadges(d, ownerId, ev.code),
      sendBadges(d, ownerId, ev.code),
    ]);

    expect(loggedRecipients().sort()).toEqual(emails.sort());
    expect(a.sentNow + b.sentNow).toBe(2);
    const scheduled = [...a.scheduled, ...b.scheduled].reduce((n, s) => n + s.count, 0);
    expect(scheduled).toBe(3);
    expect((await rowsOf(ev)).map((r) => r.emailStatus).sort()).toEqual([
      "scheduled",
      "scheduled",
      "scheduled",
      "sent",
      "sent",
    ]);
  });

  it("does not email anyone again on a second send", async () => {
    const now = tick();
    const { ownerId, ev } = await seed({ images: 2 });
    await sendBadges(deps(now), ownerId, ev.code);
    clearEmailLog();
    const again = await sendBadges(deps(now), ownerId, ev.code);
    expect(again).toEqual({ sentNow: 0, scheduled: [], failed: 0, missingImage: 0, overflow: 0 });
    expect(emailLog.batches).toEqual([]);
  });

  it("counts another owner's sends and schedules against the daily limit", async () => {
    const now = tick();
    const other = await seed({ images: 4 });
    await db
      .update(attendee)
      .set({ emailStatus: "sent", emailSentAt: new Date(now.getTime() - 3_600_000) })
      .where(inArray(attendee.id, other.ids.slice(0, 3)));
    await db
      .update(attendee)
      .set({ emailStatus: "scheduled", emailScheduledFor: new Date(now.getTime() + DAY_MS) })
      .where(eq(attendee.id, other.ids[3]));
    const mine = await seed({ images: 3 });

    const summary = await sendBadges(deps(now, { dailyLimit: 4 }), mine.ownerId, mine.ev.code);

    expect(summary.sentNow).toBe(1);
    expect(summary.scheduled).toEqual([
      { at: new Date(now.getTime() + DAY_MS).toISOString(), count: 2 },
    ]);
  });

  it("skips images rendered before the event was last edited", async () => {
    const now = tick();
    const { ownerId, ev } = await seed({ images: 3 });
    await db
      .update(event)
      .set({ updatedAt: new Date(ev.updatedAt.getTime() + 1) })
      .where(eq(event.id, ev.id));

    const summary = await sendBadges(deps(now), ownerId, ev.code);

    expect(summary).toEqual({ sentNow: 0, scheduled: [], failed: 0, missingImage: 3, overflow: 0 });
    expect(emailLog.batches).toEqual([]);
    expect((await rowsOf(ev)).every((r) => r.emailStatus === "not_sent")).toBe(true);
  });

  it("marks rejected emails failed and retries them on the next send", async () => {
    const now = tick();
    const { ownerId, ev } = await seed({ images: 2 });
    const rejecting: EmailClient = {
      sendBatch: async (emails) => emails.map(() => ({ ok: false, error: "quota" })),
      cancel: async () => {},
    };

    const summary = await sendBadges(deps(now, { client: rejecting }), ownerId, ev.code);

    expect(summary).toEqual({ sentNow: 0, scheduled: [], failed: 2, missingImage: 0, overflow: 0 });
    let rows = await rowsOf(ev);
    expect(rows.map((r) => [r.emailStatus, r.emailError, r.emailScheduledFor])).toEqual([
      ["failed", "quota", null],
      ["failed", "quota", null],
    ]);

    expect((await sendBadges(deps(now), ownerId, ev.code)).sentNow).toBe(2);
    rows = await rowsOf(ev);
    expect(rows.map((r) => [r.emailStatus, r.emailError])).toEqual([
      ["sent", null],
      ["sent", null],
    ]);
  });

  it("sends again to an explicitly chosen attendee who was already sent", async () => {
    const now = tick();
    const { ownerId, ev, ids, emails } = await seed({ images: 2 });
    await sendBadges(deps(now), ownerId, ev.code);
    clearEmailLog();

    const summary = await sendBadges(deps(now), ownerId, ev.code, { attendeeIds: [ids[1]] });

    expect(summary.sentNow).toBe(1);
    expect(loggedRecipients()).toEqual([emails[1]]);
    expect((await rowsOf(ev))[1].emailStatus).toBe("sent");
  });

  it("cancels a scheduled email before resending it", async () => {
    const now = tick();
    const { ownerId, ev, ids } = await seed({ images: 2 });
    await sendBadges(deps(now, { dailyLimit: 1 }), ownerId, ev.code);
    const oldId = (await rowsOf(ev))[1].resendId!;
    clearEmailLog();

    const summary = await sendBadges(deps(now, { dailyLimit: 1 }), ownerId, ev.code, {
      attendeeIds: [ids[1]],
    });

    expect(emailLog.cancelled).toEqual([oldId]);
    // Today and tomorrow are still taken by the first send, so it moves a day further.
    const inTwoDays = new Date(now.getTime() + 2 * DAY_MS);
    expect(summary.scheduled).toEqual([{ at: inTwoDays.toISOString(), count: 1 }]);
    const row = (await rowsOf(ev))[1];
    expect(row.emailStatus).toBe("scheduled");
    expect(row.emailScheduledFor).toEqual(inTwoDays);
    expect(row.resendId).not.toBe(oldId);
  });

  it("leaves a scheduled email alone when its cancel fails", async () => {
    const now = tick();
    const { ownerId, ev, ids } = await seed({ images: 2 });
    await sendBadges(deps(now, { dailyLimit: 1 }), ownerId, ev.code);
    const before = (await rowsOf(ev))[1];
    clearEmailLog();
    const log = createEmailClient({ mode: "log" });
    const client: EmailClient = {
      sendBatch: log.sendBatch,
      cancel: async () => {
        throw new Error("already sent");
      },
    };

    const summary = await sendBadges(deps(now, { dailyLimit: 1, client }), ownerId, ev.code, {
      attendeeIds: [ids[1]],
    });

    expect(summary.failed).toBe(1);
    expect(emailLog.batches).toEqual([]);
    expect((await rowsOf(ev))[1]).toEqual(before);
  });

  it("ignores explicit ids from another event", async () => {
    const now = tick();
    const mine = await seed({ images: 1 });
    const other = await seed({ images: 1, ownerId: mine.ownerId });
    const summary = await sendBadges(deps(now), mine.ownerId, mine.ev.code, {
      attendeeIds: [other.ids[0]],
    });
    expect(summary.sentNow).toBe(0);
    expect(emailLog.batches).toEqual([]);
  });

  it("stops scheduling when Resend rejects scheduled_at and leaves the rest unsent", async () => {
    const now = tick();
    const { ownerId, ev } = await seed({ images: 3 });
    const log = createEmailClient({ mode: "log" });
    const { client, calls } = countingClient({
      sendBatch: async (emails, key) =>
        emails[0].scheduledAt
          ? emails.map(() => ({ ok: false, error: "`scheduled_at` is not supported" }))
          : log.sendBatch(emails, key),
      cancel: log.cancel,
    });

    const summary = await sendBadges(deps(now, { dailyLimit: 1, client }), ownerId, ev.code);

    expect(summary).toEqual({ sentNow: 1, scheduled: [], failed: 0, missingImage: 0, overflow: 2 });
    expect(calls.batches).toBe(2);
    expect((await rowsOf(ev)).map((r) => [r.emailStatus, r.emailScheduledFor])).toEqual([
      ["sent", null],
      ["not_sent", null],
      ["not_sent", null],
    ]);
  });

  it("makes at most 20 Resend calls per request", async () => {
    const now = tick();
    const other = await seed({ images: 40 });
    await db
      .update(attendee)
      .set({ emailStatus: "sent", emailSentAt: new Date(now.getTime() - 3_600_000) })
      .where(eq(attendee.eventId, other.ev.id));
    const mine = await seed({ images: 2001 });
    const { client, calls } = countingClient(createEmailClient({ mode: "log" }));

    const summary = await sendBadges(deps(now, { client }), mine.ownerId, mine.ev.code);

    expect(calls.batches).toBe(20);
    expect(summary.sentNow).toBe(60);
    expect(summary.scheduled).toHaveLength(19);
    expect(summary.scheduled.every((s) => s.count === 100)).toBe(true);
    expect(summary.overflow).toBe(41);
    expect(emailLog.batches.every((b) => b.length <= 100)).toBe(true);
    const rows = await rowsOf(mine.ev);
    expect(rows.filter((r) => r.emailStatus === "not_sent")).toHaveLength(41);
  });

  it("forbids another owner", async () => {
    const { ev } = await seed({ images: 1 });
    const stranger = await createTestUser(db);
    await expect(sendBadges(deps(tick()), stranger.id, ev.code)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("readEmailConfig", () => {
  it("requires an API key and sender in resend mode", () => {
    expect(() => readEmailConfig({ EMAIL_MODE: "resend", RESEND_FROM: "a <a@b.co>" })).toThrow(
      "RESEND_API_KEY is not set",
    );
    expect(() => readEmailConfig({ EMAIL_MODE: "resend", RESEND_API_KEY: "re_x" })).toThrow(
      "RESEND_FROM is not set",
    );
    expect(
      readEmailConfig({
        EMAIL_MODE: "resend",
        RESEND_API_KEY: "re_x",
        RESEND_FROM: "certi <b@certi.app>",
        RESEND_DAILY_LIMIT: "50",
      }),
    ).toEqual({ mode: "resend", apiKey: "re_x", from: "certi <b@certi.app>", dailyLimit: 50 });
  });

  it("defaults log mode's sender and the daily limit", () => {
    expect(readEmailConfig({ EMAIL_MODE: "log" })).toEqual({
      mode: "log",
      apiKey: undefined,
      from: "certi <badges@localhost>",
      dailyLimit: 100,
    });
  });

  it("reads the test bindings", () => {
    expect(readEmailConfig(env)).toMatchObject({ mode: "log", dailyLimit: 100 });
  });

  it.each([undefined, "", "smtp"])("rejects EMAIL_MODE %o", (mode) => {
    expect(() => readEmailConfig({ EMAIL_MODE: mode })).toThrow("EMAIL_MODE must be log or resend");
  });

  it.each(["-1", "1.5", "abc", " "])("rejects RESEND_DAILY_LIMIT %o", (limit) => {
    expect(() => readEmailConfig({ EMAIL_MODE: "log", RESEND_DAILY_LIMIT: limit })).toThrow(
      "RESEND_DAILY_LIMIT",
    );
  });

  it("accepts a daily limit of 0", () => {
    expect(readEmailConfig({ EMAIL_MODE: "log", RESEND_DAILY_LIMIT: "0" }).dailyLimit).toBe(0);
  });
});

describe("createEmailClient", () => {
  const email = (to: string, scheduledAt?: string): OutgoingEmail => ({
    from: "certi <b@certi.app>",
    to,
    subject: "s",
    html: "<p>h</p>",
    text: "t",
    scheduledAt,
  });

  function fakeFetch(status: number, body: unknown) {
    const requests: Request[] = [];
    const f: typeof fetch = async (input, init) => {
      requests.push(new Request(input, init));
      return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    };
    return { f, requests };
  }

  it("records payloads and cancels in log mode", async () => {
    const client = createEmailClient({ mode: "log" });
    const results = await client.sendBatch([email("a@x.co"), email("b@x.co")], "k");
    expect(results.every((r) => r.ok)).toBe(true);
    expect(new Set(results.map((r) => r.ok && r.id)).size).toBe(2);
    await client.cancel("x1");
    expect(emailLog).toEqual({ batches: [[email("a@x.co"), email("b@x.co")]], cancelled: ["x1"] });
  });

  it("posts a batch with the idempotency key and maps the ids", async () => {
    const { f, requests } = fakeFetch(200, { data: [{ id: "id-a" }, { id: "id-b" }] });
    const client = createEmailClient({ mode: "resend", apiKey: "re_test", fetch: f });

    const results = await client.sendBatch(
      [email("a@x.co"), email("b@x.co", "2031-01-02T00:00:00.000Z")],
      "key-1",
    );

    expect(results).toEqual([
      { ok: true, id: "id-a" },
      { ok: true, id: "id-b" },
    ]);
    const [req] = requests;
    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://api.resend.com/emails/batch");
    expect(req.headers.get("Idempotency-Key")).toBe("key-1");
    expect(req.headers.get("Authorization")).toBe("Bearer re_test");
    expect(req.headers.get("x-batch-validation")).toBe("permissive");
    expect(await req.json()).toEqual([
      { from: "certi <b@certi.app>", to: ["a@x.co"], subject: "s", html: "<p>h</p>", text: "t" },
      {
        from: "certi <b@certi.app>",
        to: ["b@x.co"],
        subject: "s",
        html: "<p>h</p>",
        text: "t",
        scheduled_at: "2031-01-02T00:00:00.000Z",
      },
    ]);
    expect(emailLog.batches).toEqual([]);
  });

  it("maps permissive per-email errors by index", async () => {
    const { f } = fakeFetch(200, {
      data: [{ id: "id-a" }, { id: "id-c" }],
      errors: [{ index: 1, message: "Invalid `to` field." }],
    });
    const client = createEmailClient({ mode: "resend", apiKey: "re_test", fetch: f });
    expect(await client.sendBatch([email("a"), email("b"), email("c")], "k")).toEqual([
      { ok: true, id: "id-a" },
      { ok: false, error: "Invalid `to` field." },
      { ok: true, id: "id-c" },
    ]);
  });

  it("fails every email when the whole call is rejected", async () => {
    const { f } = fakeFetch(429, {
      statusCode: 429,
      name: "daily_quota_exceeded",
      message: "You have reached your daily email sending quota.",
    });
    const client = createEmailClient({ mode: "resend", apiKey: "re_test", fetch: f });
    expect(await client.sendBatch([email("a"), email("b")], "k")).toEqual([
      { ok: false, error: "You have reached your daily email sending quota." },
      { ok: false, error: "You have reached your daily email sending quota." },
    ]);
  });

  it("fails every email when the request never completes", async () => {
    const f: typeof fetch = async () => {
      throw new TypeError("network down");
    };
    const client = createEmailClient({ mode: "resend", apiKey: "re_test", fetch: f });
    expect(await client.sendBatch([email("a")], "k")).toEqual([
      { ok: false, error: "network down" },
    ]);
  });

  it("cancels through the email endpoint and throws when Resend refuses", async () => {
    const ok = fakeFetch(200, { object: "email", id: "e1" });
    await createEmailClient({ mode: "resend", apiKey: "re_test", fetch: ok.f }).cancel("e1");
    expect(ok.requests[0].method).toBe("POST");
    expect(ok.requests[0].url).toBe("https://api.resend.com/emails/e1/cancel");

    const refused = fakeFetch(422, { statusCode: 422, message: "Email already sent" });
    const client = createEmailClient({ mode: "resend", apiKey: "re_test", fetch: refused.f });
    await expect(client.cancel("e1")).rejects.toThrow("Email already sent");
  });

  it("requires an API key in resend mode", () => {
    expect(() => createEmailClient({ mode: "resend" })).toThrow("RESEND_API_KEY is not set");
  });
});
