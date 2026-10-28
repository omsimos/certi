# Holographic Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace certificates and the 3D badge with a templated holographic WebGPU badge. Attendees get it by a Resend email (scheduled to respect the free cap) and can export it as PNG, MP4, animated WebP and GIF.

**Architecture:**
- **Rendering is client-only.**
  - One WGSL shader (derived from vgpu's holographic card) draws the badge, reading a lettering mask that a shared 2D-canvas layout module draws.
  - That same module draws the Simple flat badge and the no-WebGPU fallback.
- **The organizer's browser renders the email images** and uploads them to R2 through owner-checked server functions.
- **The Worker handles only data, storage and email.** It never renders images.
- **Email:** a pure slot planner spreads sends under `RESEND_DAILY_LIMIT`:
  - today's slot goes out immediately;
  - later days go to Resend batch calls with `scheduled_at`.

**Tech Stack:**
- Existing: TanStack Start on Cloudflare Workers, D1 + Drizzle, R2, Better Auth.
- New: plain WebGPU (no vgpu package), `uqr` (QR), `mediabunny` (MP4), `gifenc` (GIF), a hand-written animated-WebP muxer, Resend HTTP API.

**Spec:** `docs/superpowers/specs/2026-10-28-holographic-badge-design.md`.
- Spike assets are in `docs/superpowers/specs/assets/badge-spike/`.
- `spike.wgsl` is the shader to start from; `spike-template.html` holds the per-template `mask(mode)` layouts and the pointer mapping.

## Global Constraints

- **Workers Free:** the server never renders images. Do not add any server-side image, canvas or WASM rendering dependency. Remove `@cf-wasm/og`.
- **Subrequest budget:** Workers Free allows 50 external subrequests per request. One `sendBadgesFn` call makes at most `MAX_RESEND_CALLS_PER_REQUEST = 20` Resend calls.
- **Resend limits:**
  - `RESEND_DAILY_LIMIT` defaults to `100`;
  - a batch carries at most `100` emails;
  - `scheduled_at` can be at most 30 days ahead, so slots run from day 0 to day 29.
- **No surprise emails:** nobody is emailed without an explicit Send badges or a per-row Resend. `email_status` defaults to `'not_sent'`, and existing rows backfill to it.
- **`EMAIL_MODE`:**
  - `log` (the default in dev and tests) records payloads and never calls Resend;
  - `resend` sends for real and requires `RESEND_API_KEY` and `RESEND_FROM`.
- **Shader license:** the shader file starts with this notice:

  ```
  // Derived from vercel-labs/vgpu apps/docs/examples/holographic-card (MIT License, Copyright (c) 2025 Vercel, Inc.)
  ```
- **Lazy loading:**
  - `mediabunny`, `gifenc` and the WebP muxer load only when an export is clicked;
  - the shader and renderer load only on routes that show a badge.
- **Motion:** `prefers-reduced-motion: reduce` disables tilt and the idle sweep.
- **Comments:** comment only the non-obvious *why*.
- **Commits:** `type(scope): subject`, subject only, on the current branch (`refactor/stack-overhaul`). Never push.
- **Every task ends with all of these passing:**
  - `bun run test`
  - `bun run typecheck`
  - `bun run lint`
  - `bun run format:check`

## Plan rulings (deviations from the spec's letter)

- **P1. Email image is JPEG (quality 0.88), not PNG.**
  - Why: a 1200×1706 holographic PNG is 2–3 MB, which is too heavy for email.
  - Format: JPEG renders in every client, including Outlook.
  - Server cap: 1 MB.
- **P2. Plain WebGPU, not the `vgpu` package.**
  - Why: vgpu's WGSL import needs its bundler plugin, and the package pulls a Dawn Node adapter, an MCP server and pngjs into a Workers project.
  - The spike already proves plain WebGPU. The shader is imported with Vite `?raw`.
- **P3. Branded logos are rasterized in the organizer's browser** to PNG (at most 512×512) before upload.
  - The server accepts only PNG (checked by signature, at most 512 KB).
  - This removes SVG sanitizing entirely.
- **P4. The cap probe is a maintainer script** (`scripts/resend-cap-probe.ts`). Running it needs a real Resend account, which is an account action (R5).
  - The code handles both cap behaviors: a rejected scheduled batch lands as `failed` with Resend's error.
- **P5. If Resend batch rejects `scheduled_at`,** `sendBadges` sends only today's slot. The rest stays `not_sent`, and the UI says "send again tomorrow".
- **P6. `/event/$code/` becomes a simple public event page** (title, organizer, date, description, and "Badges are emailed to attendees"). `FindEventDialog` still links to it.
- **P7. The email HTML is hand-written React components** rendered with `react-dom/server` `renderToStaticMarkup`. That's zero new dependencies, with React escaping.
- **P8. The email summary is computed client-side** from the attendee list the dashboard already loads (a pure `summarizeEmails`). There is no extra server function.
- **P9. Deleting an attendee with a scheduled email cancels it at Resend first.**
  - If the cancel fails, the delete fails with "Couldn't cancel the scheduled email. Try again."
  - Why: otherwise a deleted attendee gets an email whose link 404s.

## Review Focus

1. **Long or non-Latin names** (`Maria Clara Dela Cruz-Villanueva`, `王小明`, `محمد`):
   - the name must shrink, then wrap to two lines, and never overflow the card;
   - the font stack falls back from Geist to system fonts. Test in Task 3.
2. **Two organizers sending on the same day share one Resend account.** The planner must count every event's sends and schedules against the cap, not just this event's. Test in Task 8.
3. **Double-clicking Send badges, or two tabs,** must not email anyone twice. Rows are claimed with a conditional `UPDATE … RETURNING` before Resend is called, and the batch carries an idempotency key. Test in Task 8.
4. **The organizer closes the tab mid-render.** Attendees without an uploaded image are skipped and counted as `missingImage`, never emailed with a broken image. Pressing Send again renders only the missing or stale ones. Tests in Tasks 8 and 9.
5. **Deleting an attendee whose email is scheduled** cancels it at Resend (P9). Test in Task 8.

---

### Task 1: Remove certificates and the 3D badge

**Files:**
- Delete:
  - `src/server/cert-image.tsx`, `src/server/cert-png.ts`
  - `src/routes/api/cert/$code.$attendeeId.ts`, `src/routes/event/$code/cert.$attendeeId.tsx`
  - `src/components/badge/badge-3d.tsx`, `src/components/badge/badge-texture.ts`
  - `src/components/certificate-card.tsx`, `src/components/cert-demo.tsx`
  - `public/models/tag.glb`
  - `test/cert-png.test.ts`
- Modify:
  - `src/server/fns.ts` (remove `findAttendeeFn`, `getCertificateFn`; add `getBadgeFn`)
  - `src/server/attendees.ts` (remove `findAttendeeByEmail`; rename `getCertificate` → `getBadge`)
  - `src/routes/event/$code/index.tsx` (P6)
  - `src/routes/event/$code/badge.$attendeeId.tsx` (temporary placeholder body)
  - `src/routes/index.tsx` (drop `CertDemo`; leave a placeholder slot for Task 4)
  - `package.json` (remove `three`, `@types/three`, `@react-three/*`, `@cf-wasm/og`, and `react-parallax-tilt` if unused)
  - `README.md`, `test/attendees.test.ts`

**Interfaces:**
- Produces:
  - `getBadge(db: DB, code: string, attendeeId: string): Promise<{ attendee: Attendee; event: Event } | null>`
  - `getBadgeFn({ data: { code, attendeeId } })` → `{ attendee: { id, firstName, lastName }; event: PublicEvent } | null`. It is public and returns `null` on malformed input (same validation as the old `getCertificateFn`).

- [ ] **Step 1:** Rename the `getCertificate` tests in `test/attendees.test.ts` to `getBadge`, and delete the `findAttendeeByEmail` tests. Run `bun run test`. Expected: FAIL (`getBadge` is not exported).
- [ ] **Step 2:** Make the code changes above. After that, `grep -rn "cert\|three\|Badge3D\|findAttendee" src` returns nothing relevant.
- [ ] **Step 3:** Run `bun install`, then all four checks. Expected: PASS.
- [ ] **Step 4:** Run `bun run build`. Expected: succeeds, and there is no `three` chunk in `dist/`.
- [ ] **Step 5:** Commit: `refactor(badge): remove certificates and 3D badge`.

### Task 2: Schema — templates, email status and badge images

**Files:**
- Create:
  - `src/lib/badge/templates.ts`
  - `drizzle/<generated>.sql` (generated with `bun run db:generate`)
- Modify:
  - `src/db/schema.ts`, `src/lib/schemas.ts`, `src/server/events.ts`
- Test:
  - `test/schema.test.ts`, `test/events.test.ts`, `test/schemas.test.ts`

**Interfaces:**
- Produces, in `templates.ts`:
  - `BADGE_TEMPLATES = ["graphite", "branded", "id"] as const`
  - `type BadgeTemplate`
  - `TEMPLATE_MODE: Record<BadgeTemplate, 0 | 1 | 2>` (graphite 0, branded 1, id 2)
  - `DEFAULT_ACCENT = "#6d3cff"`
  - `accentColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i)`
- Produces, `event` columns:
  - `template` text, not null, default `'graphite'`
  - `accentColor` (`accent_color`), not null, default `'#6d3cff'`
  - `logoKey` (`logo_key`), nullable
- Produces, `attendee` columns:
  - `emailStatus` (`email_status`): `'not_sent' | 'scheduled' | 'sent' | 'failed'`, not null, default `'not_sent'`
  - `emailScheduledFor`, `emailSentAt`: `timestamp_ms`, nullable
  - `emailError`, `resendId`: nullable
  - `badgeImageKey`: nullable
  - `badgeImageVersion`: `timestamp_ms`, nullable
  - index `attendee_email_status` on `email_status`
- Produces, exported type: `EmailStatus`.
- Produces, schemas:
  - `eventInputSchema` gains `template: z.enum(BADGE_TEMPLATES).default("graphite")` and `accentColor: accentColorSchema.default(DEFAULT_ACCENT)`.
  - `eventUpdateSchema` inherits both.
  - `updateEvent` writes both, with the existing `updatedAt` bump.

- [ ] **Step 1: Write the failing tests.**
  - `schema.test.ts`, "new attendee defaults to not_sent": insert a row without email fields and expect `emailStatus === "not_sent"` and `badgeImageKey === null`.
  - `events.test.ts`, "updateEvent saves template and accent and bumps updatedAt": expect `template === "id"`, `accentColor === "#112233"`, and `updatedAt > prev.updatedAt`.
  - `schemas.test.ts`: `accentColorSchema` rejects `"red"`, `"#12345"` and `"#12345g"`, and accepts `"#A1b2C3"`.
- [ ] **Step 2:** Run `bun run test`. Expected: FAIL.
- [ ] **Step 3:** Implement the changes, then run `bun run db:generate`. Check that the generated SQL adds the columns with defaults, so existing rows read `not_sent`. Then `bun run db:migrate:local`.
- [ ] **Step 4:** Run all four checks. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(db): add badge templates and email status`.

### Task 3: Badge layout library (pure)

**Files:**
- Create:
  - `src/lib/badge/layout.ts`, `src/lib/badge/pose.ts`, `src/lib/badge/qr.ts`
  - `test/badge-layout.test.ts`, `test/badge-pose.test.ts`
- Modify: `package.json` (add `uqr`)

**Interfaces:**
- Produces, `layout.ts`:
  - `LETTERING_SIZE = [1024, 1456] as const`
  - `CARD_HALF = [0.64, 0.91] as const`
  - `VIEW_UNITS = 2.5`
  - `cardRect(width: number, height: number): { x: number; y: number; w: number; h: number }`. This is the card's pixel rect inside a canvas, using the shader's framing: `scale = min(h, w * 1.35)`, and the card spans `CARD_HALF * 2 / VIEW_UNITS * scale`, centered.
  - `type BadgeCardData = { firstName: string; lastName: string; eventTitle: string; organizer: string; date: string /* display string */; attendeeId: string; badgeUrl: string }`
  - `fitText(measure: (text: string, px: number) => number, text: string, o: { maxWidth: number; maxPx: number; minPx: number; maxLines: 1 | 2 }): { lines: string[]; px: number }`
  - `drawLettering(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, template: BadgeTemplate, data: BadgeCardData, assets: { logo?: CanvasImageSource | null; qr?: boolean[][] | null }): void`. It draws white on transparent into a `LETTERING_SIZE` canvas, porting `mask(mode)` from `spike-template.html`.
  - `maskFromImageData(data: ImageData): Uint8Array`, which keeps the alpha channel only.
  - `FONT_SANS = 'Geist, "Noto Sans", system-ui, sans-serif'` and `FONT_MONO = '"Geist Mono", ui-monospace, monospace'`.
- Produces, `pose.ts`:
  - `type Pose = { tilt: [number, number]; pointer: [number, number]; hover: number }`
  - `STILL_POSE: Pose = { tilt: [0.045, -0.035], pointer: [0.25, -0.25], hover: 0.85 }`
  - `sweepPose(phase: number): Pose`. A seamless loop over `phase ∈ [0, 1)`, so `sweepPose(0)` equals `sweepPose(1)`, with `hover` 0.8. The spike's idle path, period-matched.
  - `pointerToCard(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }): { x: number; y: number; hover: number }`. A port of vgpu `renderer.ts` `move()`.
  - `frameTimes(seconds: number, fps: number): number[]`. Phases `k / (seconds * fps)` for `k = 0 … seconds * fps − 1`.
- Produces, `qr.ts`:
  - `qrModules(text: string): boolean[][]`, using `uqr` `encode` with ecc `M` and border 0.

**fitText algorithm:**
1. Try one line, from `maxPx` down to `minPx` in 4 px steps.
2. If it still doesn't fit and `maxLines` is 2, split at the space nearest the middle and repeat.
3. If it still doesn't fit at `minPx`, end the widest line with `…`, trimmed until it fits.

**Lettering positions:**
- Graphite and Branded: the name block has `maxWidth` 884 and px 96 → 56.
- ID: the centered name has `maxWidth` 884 and px 120 → 64.
- Event title and organizer use `maxLines` 1.

- [ ] **Step 1: Write the failing tests.** Use the fake measure `(t, px) => t.length * px * 0.55`.
  - `fitText("Ana Cruz", …)` → one line at `maxPx`.
  - `fitText("Maria Clara Dela Cruz-Villanueva", { maxWidth: 884, maxPx: 96, minPx: 56, maxLines: 2 })` → 2 lines, and every line measures ≤ 884.
  - A 200-character name → 2 lines; the last ends with `…`; every line measures ≤ maxWidth.
  - A name with no spaces (`王小明王小明…`, 40 characters) → no split, shrinks, then ellipsizes, and stays within maxWidth.
  - `cardRect(1080, 1536)`: `w / h ≈ 0.64 / 0.91` (±0.01), and the rect is centered.
  - `sweepPose(0)` deep-equals `sweepPose(1)` within 1e-9.
  - `frameTimes(4, 30).length === 120`, the first value is 0, and the last value is < 1.
  - `pointerToCard` at the rect center → `{ x: 0, y: 0, hover: 1 }`; far outside → `hover: 0`.
  - `qrModules("https://x.test/a")` → a square matrix with side ≥ 21.
  - `drawLettering` with a recording fake ctx (fillText calls captured, `measureText` from the fake measure) for each template: every `fillText` x lies within [0, 1024] and the name text appears.
- [ ] **Step 2:** Run `bun run test`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run all four checks. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(badge): add badge layout, pose and QR helpers`.

### Task 4: WebGPU renderer, flat badge and the badge page

**Files:**
- Create:
  - `src/components/badge/holo.wgsl` (from `spike.wgsl`, with the license notice)
  - `src/components/badge/holo-renderer.ts`
  - `src/lib/badge/flat.ts`
  - `src/components/badge/holo-badge.tsx`
  - `test/badge-flat.test.ts`
- Modify:
  - `src/routes/event/$code/badge.$attendeeId.tsx`
  - `src/routes/index.tsx` (landing demo: a graphite `HoloBadge` with sample data)
  - `src/routes/__root.tsx` (Geist and Geist Mono font links, if not present)

**Interfaces:**
- Consumes (Task 3): layout, pose, qr, `TEMPLATE_MODE`.
- Produces, `holo-renderer.ts`:
  - `createHoloRenderer(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<HoloRenderer>`. Throws `WebGPUUnavailableError` when there is no adapter.
  - `HoloRenderer`:

    ```ts
    {
      setScene(s: { template: BadgeTemplate; accent: string; mask: Uint8Array }): void;
      draw(pose: Pose): void; // draws at the canvas's current size
      lost: Promise<void>;
      dispose(): void;
    }
    ```

  - The uniform layout is the spike's 48-byte struct: `resolution`, `tilt`, `pointer`, `hover`, `mode`, `accent: vec4f`. `accent.a` is 1 only for branded.
- Produces, `flat.ts`:
  - `drawFlatBadge(ctx, width: number, height: number, template: BadgeTemplate, accent: string, lettering: CanvasImageSource): void`
  - It draws a `#090a0c` background, then the graphite card at `cardRect` with radius `0.055` card units, accent-tinted for branded.
  - Unless the template is `id`, it adds the triangle outline (half-width 0.38, outline color `#4a5260`).
  - Then it draws the lettering tinted `#c4c9d1` into the card rect.
- Produces, `holo-badge.tsx`:
  - `HoloBadge` props:

    ```ts
    {
      template: BadgeTemplate;
      accent: string;
      data: BadgeCardData;
      logoUrl?: string | null;
      interactive?: boolean; // default true
      className?: string;
      ref?: Ref<HoloBadgeHandle>;
    }
    ```

  - `HoloBadgeHandle`:

    ```ts
    {
      backend: "webgpu" | "flat";
      renderStill(o: { width: number; height: number; type: "image/png" | "image/jpeg"; quality?: number; pose?: Pose }): Promise<Blob>;
      renderFrames(o: { width: number; height: number; times: number[]; onFrame: (canvas: OffscreenCanvas, i: number) => Promise<void>; signal?: AbortSignal }): Promise<void>;
    }
    ```

  - `renderFrames` uses a second, offscreen renderer at the export size, so the live canvas keeps running.
  - `backend` is exposed on the canvas as `data-backend`.
  - It falls back to flat when WebGPU is unavailable or `lost` resolves.
  - The flat fallback adds a CSS tilt and sheen on pointer move, plus the note: "Your browser doesn't support WebGPU, so you're seeing the flat badge."
  - Interaction follows the spike: `pointerToCard`, smoothing `1 − exp(−10·dt)`, the idle `sweepPose` after 2500 ms without input, and reduced motion.
  - The component is lazy-loaded: the badge route and landing page import it through `lazy()` inside `ClientOnly`.

- [ ] **Step 1: Write the failing tests** for `drawFlatBadge`, in `badge-flat.test.ts`, with a recording ctx:
  - for `id`, no triangle path is drawn;
  - for `branded`, the card fill uses the accent;
  - the lettering `drawImage` target equals `cardRect(w, h)`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the renderer, flat badge and component, and wire up the badge route. The route loader uses `getBadgeFn`, maps the result to `BadgeCardData` with `badgeUrl` set to the page's absolute URL from `getOriginFn`, and sets `logoUrl` to `/api/logo/${code}?v=${updatedAt}` when `logoKey` is set.
- [ ] **Step 4:** Run all four checks plus `bun run build`. Expected: PASS, and the shader is not in the entry chunk.
- [ ] **Step 5: Manual check (record the results in the report).** Run `bun run dev` in a herdr pane. With a seeded attendee, open `/event/<code>/badge/<id>` in Chrome:
  - the foil reveals on hover;
  - the idle sweep starts after 2.5 s;
  - `document.querySelector("canvas").dataset.backend === "webgpu"`;
  - all three templates render, switched via the DB;
  - with `chrome://flags` WebGPU disabled (or a `?flat` dev query param), the flat badge and the note show.
- [ ] **Step 6:** Commit: `feat(badge): render holographic badge with WebGPU`.

### Task 5: Exports — PNG, MP4, animated WebP, GIF

**Files:**
- Create:
  - `src/lib/badge/export/webp-mux.ts`, `src/lib/badge/export/mp4.ts`, `src/lib/badge/export/gif.ts`, `src/lib/badge/export/webp.ts`
  - `src/components/badge/export-menu.tsx`
  - `test/webp-mux.test.ts`
- Modify:
  - `package.json` (add `mediabunny`, `gifenc`)
  - `src/routes/event/$code/badge.$attendeeId.tsx`

**Interfaces:**
- Consumes: `HoloBadgeHandle` (Task 4), `frameTimes` (Task 3).
- Produces:
  - `muxAnimatedWebp(frames: Uint8Array[], o: { width: number; height: number; frameMs: number; loop?: number }): Uint8Array`
    - Each frame is a complete RIFF WEBP file, as produced by `convertToBlob({ type: "image/webp" })`.
    - Output: `RIFF` + `WEBP` + `VP8X` (animation flag `0x02`, canvas width−1 and height−1 as 24-bit LE) + `ANIM` (background 0, loop count) + one `ANMF` per frame wrapping that frame's `VP8 `/`VP8L` (+`ALPH`) chunks, with chunk payloads padded to even length.
  - `exportMp4(handle, o: { signal?, onProgress? }): Promise<Blob>`: 1080×1536, 30 fps, 4 s, `avc`, via mediabunny `CanvasSource`, `Mp4OutputFormat` and `BufferTarget`.
  - `exportWebp(handle, o): Promise<Blob>`: 720×1024, 24 fps, 4 s.
  - `exportGif(handle, o): Promise<Blob>`: 540×768, 20 fps, 4 s, gifenc with a per-frame `quantize(…, 256)`, looping forever.
  - Support checks, each `(): Promise<boolean>`:
    - `canExportMp4` uses mediabunny `canEncodeVideo("avc", { width: 1080, height: 1536 })`;
    - `canExportWebp` checks that `new OffscreenCanvas(2, 2).convertToBlob({ type: "image/webp" })` yields `type === "image/webp"`;
    - `canExportGif` is true when `OffscreenCanvas` exists.
- **ExportMenu:**
  - **Buttons:** "PNG", "MP4 · for Instagram / TikTok / X", "Animated WebP" and "GIF".
  - **Availability:** each button is hidden when unsupported. Only PNG shows on the flat backend.
  - **During an export:** a progress bar and a Cancel button (an AbortController); other buttons are disabled while one runs.
  - **Encoders:** loaded via dynamic `import()`.
  - **Download file names:** `badge-<attendeeId>.<png|mp4|webp|gif>`.
  - **PNG:** `renderStill({ width: 1080, height: 1536, type: "image/png", pose: <current pose> })`.

- [ ] **Step 1: Write the failing tests** in `webp-mux.test.ts`. Build two synthetic frames (`RIFF…WEBP` + a `VP8L` chunk with 5 bytes of payload) and call `muxAnimatedWebp(frames, { width: 720, height: 1024, frameMs: 42 })`. Assert:
  - the bytes start with `RIFF`;
  - the RIFF size equals `length − 8`;
  - `WEBP` is at offset 8;
  - a `VP8X` chunk has flags `& 0x02`, and its width field is 719 and height field 1023;
  - an `ANIM` chunk has loop 0;
  - there are exactly 2 `ANMF` chunks, each with duration 42 and containing a `VP8L` chunk;
  - every chunk starts at an even offset.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement the muxer, then the encoders and the menu.
- [ ] **Step 4:** Run all four checks plus `bun run build`. Expected: PASS, and `mediabunny` and `gifenc` are in separate chunks.
- [ ] **Step 5: Manual check (recorded).** In Chrome, each format downloads, and:
  - the MP4 plays in a video player and loops cleanly;
  - the WebP animates in Chrome;
  - the GIF animates;
  - Cancel stops an export midway.
- [ ] **Step 6:** Commit: `feat(badge): export badge as PNG, MP4, WebP and GIF`.

### Task 6: Template picker, accent and logo upload

**Files:**
- Create:
  - `src/server/assets.ts`
  - `src/routes/api/logo/$code.ts`
  - `src/components/template-picker.tsx`
  - `test/assets.test.ts`
- Modify:
  - `src/components/event-form.tsx`, `src/server/fns.ts`

**Interfaces:**
- Produces, `assets.ts`:
  - `isPng(bytes: Uint8Array): boolean` and `isJpeg(bytes: Uint8Array): boolean`, by signature.
  - `MAX_LOGO_BYTES = 512 * 1024`
  - `saveEventLogo(db: DB, bucket: R2Bucket, ownerId: string, code: string, bytes: Uint8Array): Promise<Event>`
    - Owner-checked; rejects non-PNG or oversized files with `ValidationError`.
    - Key: `logos/<eventId>/<newUpdatedAt ms>.png`.
    - Deletes the previous key and bumps `updatedAt`, using the same strictly-increasing rule as `updateEvent`.
  - `removeEventLogo(db, bucket, ownerId, code): Promise<Event>`
- Produces, server functions:
  - `uploadLogoFn`: FormData with `code` and `file`. `.validator` rejects anything that isn't a FormData with those fields.
  - `removeLogoFn({ code })`
- Produces, route: `GET /api/logo/$code` → the PNG from R2.
  - `cache-control: public, max-age=0, must-revalidate`, with ETag = key.
  - 404 when there is no logo.
- **TemplatePicker:**
  - three options, each with a live non-interactive `HoloBadge` preview using the event's sample data;
  - for Branded, a native `<input type="color">` for the accent, plus a logo file input.
  - The logo input accepts `image/*`, including SVG. The browser draws it into a ≤512×512 canvas, contained, and uploads it with `toBlob("image/png")` (P3).

- [ ] **Step 1: Write the failing tests.**
  - `isPng` / `isJpeg` true and false cases.
  - `saveEventLogo`:
    - rejects a JPEG and a 600 KB PNG;
    - rejects another owner with `ForbiddenError`;
    - stores the key and bumps `updatedAt`;
    - a second upload deletes the first R2 object (`bucket.head(oldKey) === null`).
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the code, then wire `template` and `accentColor` into `EventForm` (create and edit). The picker uploads the logo only in edit mode; in create mode it says "Add a logo after creating the event".
- [ ] **Step 4:** Run all four checks. Expected: PASS.
- [ ] **Step 5: Manual check.** Switch templates in the Details tab and save, and the badge page reflects the change. Upload an SVG logo, and it appears on the Branded card.
- [ ] **Step 6:** Commit: `feat(dashboard): add badge template picker and logo upload`.

### Task 7: Badge image storage and serving

**Files:**
- Create:
  - `src/server/badge-images.ts`
  - `src/routes/api/badge/$code.$attendeeId.ts`
  - `test/badge-images.test.ts`
- Modify:
  - `src/server/fns.ts`
  - `src/routes/event/$code/badge.$attendeeId.tsx` (`og:image`)

**Interfaces:**
- Consumes: `isJpeg` (Task 6).
- Produces:
  - `MAX_BADGE_IMAGE_BYTES = 1024 * 1024`
  - `badgeImageKey(attendeeId: string, version: Date): string` → `badges/v1/<attendeeId>/<version ms>.jpg`
  - `saveBadgeImage(db, bucket, ownerId, code, attendeeId, bytes: Uint8Array, version: number): Promise<void>`
    - Owner- and event-scoped; JPEG only; size-capped.
    - Rejects with `ValidationError` "Event changed, re-render" when `version !== event.updatedAt` in ms. This prevents uploading an image rendered from stale data.
    - Sets `badgeImageKey` and `badgeImageVersion` and deletes the previous object.
  - `getBadgeImage(db, bucket, code, attendeeId): Promise<{ key: string; body: ReadableStream } | null>`
  - `uploadBadgeImageFn`: FormData with `code`, `attendeeId`, `version` and `file`.
  - Route `GET /api/badge/$code/$attendeeId`:
    - serves the JPEG with `cache-control: public, max-age=0, must-revalidate`, ETag = key, and a 304 on match;
    - returns 404 for malformed params or no image;
    - ignores any `?v=` query.
  - Badge page `og:image`: `${origin}/api/badge/${code}/${attendeeId}?v=${badgeImageVersion}` when the image exists; otherwise `${origin}/og-default.png` (add `public/og-default.png`, a 1200×630 export of the landing demo badge).

- [ ] **Step 1: Write the failing tests.**
  - `saveBadgeImage`:
    - stores the image and sets the version;
    - rejects a PNG, 1.1 MB of JPEG bytes and a stale `version`;
    - rejects an attendee of another event under this code with `NotFoundError`, and another owner with `ForbiddenError`;
    - replacing an image deletes the old object.
  - `getBadgeImage` returns `null` before an upload.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run all four checks. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(badge): store and serve badge images from R2`.

### Task 8: Email sending core

**Files:**
- Create:
  - `src/server/email/client.ts`, `src/server/email/slots.ts`, `src/server/email/badge-email.tsx`, `src/server/email/send-badges.ts`
  - `test/email-slots.test.ts`, `test/send-badges.test.ts`, `test/badge-email.test.ts`
- Modify:
  - `src/server/attendees.ts` (`deleteAttendee` cancel, P9)
  - `src/server/fns.ts`
  - `wrangler.jsonc` (`vars`: `EMAIL_MODE: "resend"`, `RESEND_DAILY_LIMIT: "100"`)
  - `.dev.vars.example` (`EMAIL_MODE=log`, `RESEND_API_KEY=`, `RESEND_FROM=`)
  - `vitest.config.ts` (bindings `EMAIL_MODE: "log"`, `RESEND_DAILY_LIMIT: "100"`)
  - `worker-configuration.d.ts` (via `bun run cf-typegen`)

**Interfaces:**
- Produces, `client.ts`:
  - The email and result types:

    ```ts
    type OutgoingEmail = { from: string; to: string; subject: string; html: string; text: string; scheduledAt?: string };
    type SendResult = { ok: true; id: string } | { ok: false; error: string };
    ```

  - `EmailClient`:

    ```ts
    {
      sendBatch(emails: OutgoingEmail[], idempotencyKey: string): Promise<SendResult[]>; // index-aligned with emails
      cancel(id: string): Promise<void>;
    }
    ```

  - `createEmailClient(cfg: { mode: "log" | "resend"; apiKey?: string; fetch?: typeof fetch }): EmailClient`
  - `emailLog: { batches: OutgoingEmail[][]; cancelled: string[] }`, with `clearEmailLog()`.
  - Resend mode:
    - `sendBatch` calls `POST https://api.resend.com/emails/batch` with the `Idempotency-Key` header and per-email `scheduled_at`.
    - The implementer confirms in Resend's current docs how per-email errors come back (permissive validation) and maps them to `SendResult`.
    - A whole-call failure (non-2xx) maps every email to `{ ok: false, error: <message> }`.
    - `cancel` calls `POST /emails/{id}/cancel`.
- Produces, `slots.ts`:
  - `DAY_MS = 86_400_000`
  - `planSendSlots(i: { count: number; now: Date; dailyLimit: number; commitments: Date[]; maxDays?: number /* 30 */ }): { slots: { at: Date; size: number }[]; overflow: number }`
  - The algorithm, which is conservative for both rolling-24h and calendar-day quotas:
    1. Candidates are `T_k = now + k·DAY_MS` for `k = 0 … maxDays − 1`.
    2. `capacity(T_k) = dailyLimit − #{ c ∈ commitments ∪ already-planned : |c − T_k| < DAY_MS }`.
    3. Fill greedily in k order, and drop empty slots.
    4. `slots[0].at === now` means "send immediately".
- Produces, `badge-email.tsx`:
  - `renderBadgeEmail(d: { firstName: string; eventTitle: string; organizer: string; badgeUrl: string; imageUrl: string }): { subject: string; html: string; text: string }`
  - Subject: `Your badge for ${eventTitle}`.
  - The HTML is table-based, 600 px wide, on a dark `#090a0c` background. It contains:
    - the heading `Hi ${firstName}, here's your badge`;
    - the organizer and event line;
    - `<a href=badgeUrl><img src=imageUrl width=600 alt="Your badge for …"></a>`;
    - a "View your badge" button.
  - The text part carries the URL.
- Produces, `send-badges.ts`:
  - `SendDeps = { db: DB; client: EmailClient; now: Date; dailyLimit: number; origin: string; from: string }`
  - `MAX_RESEND_CALLS_PER_REQUEST = 20` and `BATCH_SIZE = 100`
  - `SendSummary = { sentNow: number; scheduled: { at: string; count: number }[]; failed: number; missingImage: number; overflow: number }`
  - `sendBadges(deps: SendDeps, ownerId: string, code: string, opts?: { attendeeIds?: string[] }): Promise<SendSummary>`

**`sendBadges` steps:**
1. Get the owned event and the candidates:
   - with `attendeeIds`: those ids within the event, any status;
   - without: status `not_sent` or `failed`.
2. Candidates without `badgeImageKey`, or with `badgeImageVersion ≠ event.updatedAt`, are skipped and counted as `missingImage`.
3. Commitments are global across all events: `sent` with `emailSentAt > now − DAY_MS`, plus `scheduled` with `emailScheduledFor > now − DAY_MS`.
4. Plan the slots, capping the total at `MAX_RESEND_CALLS_PER_REQUEST × BATCH_SIZE`; the excess counts as overflow.
5. Claim each slot's rows with a conditional update, in chunks of 90 ids (under D1's parameter limit). Only returned ids proceed:

   ```sql
   UPDATE attendee
   SET email_status = 'scheduled', email_scheduled_for = <at>
   WHERE id IN (…) AND email_status IN (<allowed>)
   RETURNING id
   ```

   - `<allowed>` is `not_sent`/`failed`, or any status for an explicit resend.
   - For an explicit resend of a `scheduled` row that has a `resendId`, call `client.cancel` first.
6. Send each slot in batches of 100. `scheduledAt` is omitted for slot 0 and is `at.toISOString()` otherwise. The idempotency key is the SHA-256 hex of `${event.id}|${at.getTime()}|${ids.join(",")}`.
7. Record the results:
   - ok on slot 0 → `sent`, with `emailSentAt = now` and `resendId`;
   - ok on a later slot → `scheduled`, with `resendId`;
   - not ok → `failed`, with `emailError` and `emailScheduledFor = null`.
8. **P5:** if every email in a later slot fails with an error mentioning `scheduled_at`, the remaining later slots are not attempted, and those rows go back to `not_sent`.
9. `imageUrl = ${origin}/api/badge/${code}/${id}?v=${badgeImageVersion ms}`, and `badgeUrl = ${origin}/event/${code}/badge/${id}`.

**Server functions and attendee changes:**
- `sendBadgesFn({ code, attendeeIds?: string[] (max 2000) })`:
  - builds deps from env (`EMAIL_MODE`, `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_DAILY_LIMIT`);
  - throws `"RESEND_API_KEY is not set"` / `"RESEND_FROM is not set"` in resend mode when either is missing;
  - origin is `env.BETTER_AUTH_URL`, falling back to the request origin.
- `deleteAttendee` gains `opts?: { cancel?: (resendId: string) => Promise<void> }`. A `scheduled` row with a `resendId` is cancelled first, and a cancel failure throws `ScheduledEmailCancelError` (added to the error-name adapter).
- `deleteAttendeeFn` passes the client's `cancel`.

**Steps:**
- [ ] **Step 1: Write the failing tests.**
  - `email-slots.test.ts`:
    - `count 250, limit 100, no commitments` → sizes `[100, 100, 50]` at `now`, `now+1d` and `now+2d`; overflow 0.
    - 60 commitments at `now − 2h` → slot 0 has size 40, and slot `+1d` has 100.
    - 30 commitments at `now + 1d` (another event's schedule) → the `+1d` slot has size 70.
    - `count 3001, limit 100` → 30 slots, overflow 1, and the last slot is < `now + 30d`.
    - `dailyLimit 0` → no slots, overflow = count.
  - `badge-email.test.ts`:
    - the subject;
    - the html contains the `imageUrl` with `?v=` and the `badgeUrl`;
    - `firstName: "<script>x</script>"` comes out escaped, with no raw `<script>`;
    - the text contains the `badgeUrl`.
  - `send-badges.test.ts` (log-mode client, seeded event with images):
    - 3 attendees with images plus 1 without, `dailyLimit 2` → `sentNow 2`, one scheduled at `+1d`, `missingImage 1`. `emailLog.batches[1][0].scheduledAt` is set. DB statuses are `sent, sent, scheduled, not_sent`.
    - Calling it twice concurrently (`Promise.all`) → each attendee appears in exactly one logged email.
    - Commitments from **another owner's event** reduce capacity.
    - A stale image (event updated after upload) counts as `missingImage`.
    - A fake client returning `{ ok: false, error: "quota" }` → rows `failed` with `emailError "quota"`, and a later call retries them.
    - An explicit resend of a `sent` attendee sends again.
    - Another owner → `ForbiddenError`.
    - Resend mode without `RESEND_API_KEY` → the error message above, which the env-reading helper exports for testing.
  - `attendees.test.ts`:
    - deleting a `scheduled` attendee calls `cancel` with its `resendId`;
    - a throwing `cancel` → `ScheduledEmailCancelError`, and the row still exists.
  - `createEmailClient` resend mode with a fake `fetch`:
    - posts to `/emails/batch` with the `Idempotency-Key` header and maps the response ids;
    - a 429 response maps every email to `ok: false`.
- [ ] **Step 2:** Run `bun run test`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run all four checks. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(email): send badge emails via Resend with scheduled slots`.

### Task 9: Dashboard sending UI

**Files:**
- Create:
  - `src/lib/email-summary.ts`, `src/lib/badge/render-email-images.ts`
  - `src/components/send-badges-dialog.tsx`
  - `test/email-summary.test.ts`
- Modify:
  - `src/routes/dashboard/$code.tsx`, `src/components/attendee-table.tsx`

**Interfaces:**
- Consumes:
  - `HoloBadge` / renderer and `drawFlatBadge` (Task 4);
  - `uploadBadgeImageFn` (Task 7);
  - `sendBadgesFn` and `SendSummary` (Task 8).
- Produces, `email-summary.ts`:
  - `summarizeEmails(attendees: Attendee[], eventUpdatedAt: Date): { notSent: number; failed: number; sent: number; scheduled: { date: string /* YYYY-MM-DD local */; count: number }[]; needsImage: number }`
  - `needsImage` counts attendees that will be sent (`not_sent`/`failed`) and have no image, or whose image version is not the event's `updatedAt`.
- Produces, `render-email-images.ts`:
  - `renderEmailImages(o: { mode: "rendered" | "simple"; event: { code: string; template: BadgeTemplate; accentColor: string; updatedAt: Date; title: string; organizer: string; date: string }; logoUrl: string | null; attendees: Pick<Attendee, "id" | "firstName" | "lastName">[]; origin: string; concurrency?: number /* 4 */; signal?: AbortSignal; onProgress?: (done: number, total: number) => void }): Promise<{ uploaded: number; failed: { id: string; error: string }[] }>`
  - Rendered mode uses one offscreen `HoloRenderer` at 1200×1706 and `STILL_POSE`, output as `image/jpeg` quality 0.88.
  - Simple mode uses `drawFlatBadge` at the same size.
  - Each image uploads with `version = updatedAt ms`.
- **SendBadgesDialog:**
  1. **Choose.** A radio between Rendered and Simple.
     - Rendered shows the disclaimer: "Uses your browser's GPU (WebGPU). Keep this tab open while badges render, about {≈0.3 s × count} seconds for this list."
     - When WebGPU is unavailable, Rendered is disabled, the disclaimer adds "Not available in this browser.", and Simple is selected.
  2. **Rendering.** Shows "Rendering N of M" with a Cancel button. Only `needsImage` attendees are rendered.
  3. **Sending.** Calls `sendBadgesFn`.
  4. **Done.** Shows the summary:
     - "Sent X now";
     - "Y scheduled for <date>" per slot;
     - "Z skipped: no image";
     - "W left — send again tomorrow" when there's overflow;
     - failures.
  5. Then calls `router.invalidate()`.
- **Event page:**
  - A summary line above the attendee table: "180 sent · 100 scheduled for Oct 30 · 20 not sent · 3 failed".
  - A Send badges button, disabled with the tooltip "Everyone has been emailed" when nothing is `not_sent`/`failed`.
- **AttendeeTable:**
  - A status column: Not sent / Scheduled · Oct 30 / Sent · Oct 28 / Failed (with an `emailError` tooltip).
  - An "image out of date" badge when `badgeImageVersion` is set and differs from `event.updatedAt`.
  - A row action **Resend**. It renders that one attendee's image if needed (in the dialog's chosen mode, defaulting to Rendered when available), then calls `sendBadgesFn({ code, attendeeIds: [id] })`.

- [ ] **Step 1: Write the failing tests** in `email-summary.test.ts`:
  - mixed statuses give the right counts;
  - scheduled rows are grouped by date;
  - `needsImage` counts missing and stale images, but not `sent` rows.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run all four checks. Expected: PASS.
- [ ] **Step 5: Manual check (recorded).** Run with `EMAIL_MODE=log` and a forged session, as in the overhaul:
  - import 3 attendees, then Send badges with Rendered;
  - the progress line and summary show;
  - the statuses update;
  - closing the dialog mid-render, then sending again, renders only the rest;
  - Simple mode works with WebGPU disabled;
  - a per-row Resend works.
- [ ] **Step 6:** Commit: `feat(dashboard): send badges with rendered or simple images`.

### Task 10: Docs, cap probe and cleanup

**Files:**
- Create: `scripts/resend-cap-probe.ts`
- Modify: `README.md`, `.dev.vars.example`, `package.json` (script `probe:resend-cap`)

**The probe script** (`bun scripts/resend-cap-probe.ts`, reads `RESEND_API_KEY` and `RESEND_FROM`):
1. Batch-schedules `RESEND_DAILY_LIMIT + 1` emails (in batches of at most 100) to `delivered@resend.dev` for `now + 1 day`.
2. Prints `counts at schedule time` if any are rejected for quota, otherwise `counts at send time`.
3. Prints `batch scheduled_at unsupported` if Resend rejects `scheduled_at` on batch.
4. Cancels every accepted id.

**The README covers:**
- the badge flow;
- templates;
- Resend setup: account, domain verification, `wrangler secret put RESEND_API_KEY`, `RESEND_FROM`, `EMAIL_MODE`;
- what the probe does and how to read its result;
- free-tier limits (100/day shared across all events, 3,000/month, 30-day horizon);
- WebGPU browser support and the Simple fallback;
- the manual check list from Tasks 4, 5, 6 and 9.

- [ ] **Step 1:** Write the script and docs.
- [ ] **Step 2:** Run all four checks plus `bun run build` and `wrangler deploy --dry-run`. Expected: PASS, with the gzip size reported.
- [ ] **Step 3:** Commit: `docs(email): document Resend setup and cap probe`.
