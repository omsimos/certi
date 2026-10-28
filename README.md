![image](https://github.com/hyamero/certificate-generator/assets/78056869/a8b0c19a-34e3-49ed-8a46-34276366b823)
![image](https://github.com/user-attachments/assets/706c43c7-9c41-408a-a5ae-1a9052af16f3)

# Certi

Event badges. An organizer creates an event, imports attendees, picks a template and emails each attendee a holographic WebGPU badge. Attendees open their badge page to tilt it and export it as PNG, MP4, WebP or GIF.

## How it works

1. The organizer creates an event, imports attendees and picks a template (Graphite, Branded or ID).
2. Nobody is emailed until the organizer presses **Send badges** (or a per-row **Resend**).
3. The email image is rendered in the organizer's browser, **Rendered** (the WebGPU shader) or **Simple** (flat), as a JPEG and uploaded to R2. The server renders nothing, which keeps it inside Workers Free limits.
4. The server sends through Resend's batch endpoint, spreading emails over scheduled slots so the daily cap is respected (at most 30 days ahead).
5. The email links to `/event/<code>/badge/<attendeeId>`, where the attendee sees the live badge and can export it.

Email statuses: not sent, scheduled, sent, failed. A scheduled email whose time has passed shows as sent.

### Templates

- **Graphite**: the default dark card.
- **Branded**: an accent colour and an uploaded logo. The logo is rasterized to PNG (at most 512x512) in the browser before upload.
- **ID**: adds a QR code that points to the badge page.

### Badge page and exports

Exports run in the browser: PNG 1080x1536, MP4 1080x1536 at 30 fps, animated WebP 720x1024 at about 24 fps and GIF 540x768 at about 20 fps. Animations are 4 s loops. Encoders load only when an export is clicked.

WebGPU is needed for the holographic card (current Chrome and Edge, Safari 26+, recent Firefox on supported platforms). Without it the page shows a flat card with a CSS tilt and sheen, and only PNG export is offered. In dev, `?flat` forces that fallback. `prefers-reduced-motion: reduce` disables the tilt and the idle sweep.

The emailed links and the QR code use `BETTER_AUTH_URL` as the public origin (falling back to the request origin).

## Stack

- [TanStack Start](https://tanstack.com/start) (React 19) on Cloudflare Workers
- D1 (SQLite) with Drizzle ORM
- R2 for object storage
- Better Auth with Google and GitHub sign-in
- Tailwind v4 and shadcn/ui on Base UI
- oxlint and oxfmt
- Vitest with `@cloudflare/vitest-plugin` (tests run in workerd)

## Local setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Copy `.dev.vars.example` to `.dev.vars` and fill it in:
   - `BETTER_AUTH_SECRET`: generate with `openssl rand -base64 32`
   - `BETTER_AUTH_URL`: `http://localhost:3000`
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` and `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`, with these OAuth callback URLs:
     - `http://localhost:3000/api/auth/callback/google`
     - `http://localhost:3000/api/auth/callback/github`

3. Apply the migrations to the local D1 database:

   ```bash
   bun run db:migrate:local
   ```

4. Start the dev server on http://localhost:3000:

   ```bash
   bun run dev
   ```

The app boots without OAuth credentials, but signing in needs them. A provider with empty credentials is disabled.

## Scripts

| Script                      | What it does                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `bun run dev`               | Vite dev server on port 3000 (runs in workerd)                                                                          |
| `bun run build`             | Production build                                                                                                        |
| `bun run preview`           | Build, then serve the production build locally                                                                          |
| `bun run deploy`            | Build, then `wrangler deploy`                                                                                           |
| `bun run lint`              | Run oxlint                                                                                                              |
| `bun run format`            | Format with oxfmt                                                                                                       |
| `bun run format:check`      | Check formatting without writing                                                                                        |
| `bun run typecheck`         | Run `tsc --noEmit`                                                                                                      |
| `bun run test`              | Run the Vitest suite once                                                                                               |
| `bun run probe:resend-cap`  | Probe how Resend counts scheduled emails against the daily cap (needs real credentials)                                 |
| `bun run db:generate`       | Generate a Drizzle migration after a schema change                                                                      |
| `bun run db:migrate:local`  | Apply migrations to the local D1 database                                                                               |
| `bun run db:migrate:remote` | Apply migrations to the production D1 database                                                                          |
| `bun run cf-typegen`        | Run `wrangler types --env-file .dev.vars.example` to regenerate binding and secret types in `worker-configuration.d.ts` |

## Deploying (first time)

These steps need the maintainer's Cloudflare account and OAuth apps.

1. Log in: `bunx wrangler login`
2. Create the database: `bunx wrangler d1 create certi`, then paste the printed `database_id` into `wrangler.jsonc` (it is `"local"` in the repo).
3. Create the bucket: `bunx wrangler r2 bucket create certi-certs`
4. Set each secret with `bunx wrangler secret put <NAME>`:
   - `BETTER_AUTH_SECRET`
   - `BETTER_AUTH_URL`: the production origin, for example `https://certi.<account>.workers.dev`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`

   Add the production callback URLs to both OAuth apps: `<BETTER_AUTH_URL>/api/auth/callback/google` and `<BETTER_AUTH_URL>/api/auth/callback/github`.

5. Apply the migrations: `bun run db:migrate:remote`
6. Deploy: `bun run deploy`

The Worker deliberately refuses to start without `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`, so set them before or right after the first deploy.

## Email setup (Resend)

1. Create a [Resend](https://resend.com) account and an API key.
2. Add and verify your sending domain in Resend (DNS records). Without a verified domain Resend only delivers to your own address.
3. Set the secrets:

   ```bash
   bunx wrangler secret put RESEND_API_KEY
   bunx wrangler secret put RESEND_FROM   # e.g. certi <badges@yourdomain.com>
   ```

4. `EMAIL_MODE` is `resend` in `wrangler.jsonc` vars for production and `log` in `.dev.vars.example`. In `log` mode payloads are recorded in memory and Resend is never called. `resend` mode refuses to start without `RESEND_API_KEY` and `RESEND_FROM`.
5. `RESEND_DAILY_LIMIT` (default `100`) is the daily cap the scheduler plans against. Raise it only if you upgrade your Resend plan.

### Free-tier limits

- 100 emails per day and 3,000 per month. The daily cap is shared by every event on the deployment.
- `scheduled_at` can be at most 30 days ahead. Slots are a day and 15 minutes apart (so a rolling 24-hour cap has reset), and the last one falls before day 30.
- Each Send badges call handles at most 100 emails (`MAX_EMAILS_PER_REQUEST`); the dashboard repeats calls until done. A claim left by an interrupted call can be retaken after 10 minutes.

### Cap probe

Resend does not say whether a scheduled email counts against the daily cap when it is scheduled or when it is sent. `scripts/resend-cap-probe.ts` finds out. It reads `RESEND_DAILY_LIMIT` (default `100`) from the environment, schedules `RESEND_DAILY_LIMIT + 1` emails to `delivered@resend.dev` for tomorrow, then cancels every accepted one (also on failure), two per second with one retry on a rate limit.

The first batch also carries one deliberately invalid recipient, and the probe prints that batch's raw response. Check it lists only the accepted emails in `data` and the invalid one by index in `errors`: the app relies on that shape to match Resend ids to attendees, and records a batch with any other shape under an unknown id.

```bash
RESEND_API_KEY=re_... RESEND_FROM="certi <badges@yourdomain.com>" bun run probe:resend-cap
```

It uses real quota and needs a real account, so run it deliberately, not in CI. Read the verdict:

- `counts at schedule time`: some emails were rejected for quota. Scheduling ahead does not help; the cap applies on the day you schedule.
- `counts at send time`: nothing was rejected. Scheduling ahead spreads load across days as designed.
- `batch scheduled_at unsupported`: Resend rejected `scheduled_at` on batch. The app then sends only today's slot and leaves the rest not sent ("send again tomorrow").

An `inconclusive` verdict (exit code 2) means the rejection did not match any of these; read the printed messages.

## Manual check list

The browser checks below need a WebGPU-capable browser and are not covered by tests. Run `bun run dev` with `EMAIL_MODE=log`, a seeded event and a few attendees.

- [ ] Open `/event/<code>/badge/<id>` in Chrome: the foil reveals on hover, the idle sweep starts after the last input and on load, and `document.querySelector("canvas").dataset.backend === "webgpu"`.
- [ ] All three templates render. Branded works with an accent and with an uploaded logo (including an SVG logo, which is rasterized to PNG).
- [ ] With WebGPU disabled in `chrome://flags`, or with `?flat`, the flat card, CSS tilt, sheen and the note show, and only PNG export is offered.
- [ ] Reduced motion disables tilt and sweep. Touch works on mobile and the card survives a resize.
- [ ] Exports download and open: PNG, MP4 (loops), animated WebP, GIF. Cancel works mid-export.
- [ ] Template picker: switch templates and save; changing the accent updates the previews once the picker closes; the logo upload round-trips.
- [ ] Send badges with Rendered: progress, summary and statuses update. Close mid-render, then resend renders only the rest.
- [ ] Send badges with Simple while WebGPU is disabled.
- [ ] Per-row Resend works, including on an already sent row.
- [ ] Template picker in create mode (Graphite selected): switch to Branded, change the accent, save, and the event keeps that accent.
- [ ] Edit the event after some emails are scheduled: the event page offers Refresh images, and afterwards `/api/badge/<code>/<id>` serves the new image.
- [ ] Scan the ID template's QR code with a phone: it opens that attendee's badge page.
- [ ] Safari < 16.4 (no OffscreenCanvas): the badge page shows the flat badge or the plain card, never a blank box, and the PNG download works.

## Known limits

- **Import size.** Attendee imports are capped at 2000 rows.
- **Possible duplicate on timeout.** If a request times out after Resend accepted a batch, re-sending can email those attendees twice.
- **Unknown Resend ids.** If a batch response doesn't have the expected shape, its emails are recorded as accepted under an unknown id. Those can't be cancelled: deleting such an attendee leaves their scheduled email in place, and a per-row Resend is refused until it has gone out.
- **Shared cap race.** Two events sending at the same moment can briefly exceed the shared daily cap. The extra emails fail visibly and can be re-sent.
- **Workers Free CPU.** The 10 ms CPU limit is tight for a 100-email batch. After deploying, measure with `bunx wrangler tail`.
- **Old browsers.** Flat lettering needs `OffscreenCanvas` 2D (Safari 16.4+).

## Credits

The holographic shader is derived from the holographic-card example in [vercel-labs/vgpu](https://github.com/vercel-labs/vgpu) (MIT License, Copyright (c) 2025 Vercel, Inc.).

## Contributing

If you wish to suggest or work on a new feature, please open an issue to discuss with the community and the project maintainers. We appreciate your interest and look forward to collaborating with you!

## License

This project is licensed under the MIT License. See the [`LICENSE`](https://github.com/omsimos/certi/blob/main/LICENSE) file for details.
