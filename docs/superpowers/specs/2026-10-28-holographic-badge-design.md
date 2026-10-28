# Holographic badge, templates and email delivery — design

Status: for approval · 2026-10-28 · branch `refactor/stack-overhaul` (PR #5)

## Intent

certi stops issuing certificates. Attendees get a **holographic badge** instead: a card rendered
live by a WebGPU shader (from vgpu's holographic-card example) that reacts to their pointer or
finger.

Organizers no longer send people to "find your certificate by email". certi **emails each
attendee their badge**, and the badge in that email links to the interactive version on the
website. There the attendee can also download it as a still image or as a short animation to
post.

The why: the badge is the part people want to show off. A tilting, foil-revealing card gets
shared; a certificate gets filed. Everything runs on free tiers (Cloudflare Workers Free, Resend
Free).

## Goals

1. **Badge page.** An interactive holographic badge page per attendee, rendered with the vgpu
   holographic shader, with the attendee's name, event and date.
2. **Templates.** The organizer picks one of three badge designs per event:
   - **Graphite:** the vgpu original. Graphite card, Geist type, triangle outline with a fractal
     engraving.
   - **Branded:** the organizer's accent color tints the graphite, plus an uploaded logo.
   - **ID:** no triangle. Foil engraving over the whole card, name centered, attendee ID, and a QR
     code that opens the badge page.
3. **Email delivery.** The organizer presses **Send badges**, and each attendee gets a styled HTML
   email showing an image of their badge. Clicking the image opens their badge page.
   - The organizer picks the email image: **Rendered** (the real shader) or **Simple** (a flat badge
     with no shader).
   - The organizer can see who hasn't been emailed, or whose email failed, and send again.
4. **Downloads.** The badge page offers a still PNG and an animated loop in **several formats**: MP4,
   animated WebP and GIF.
5. **Free plans only.** The server does no image rendering at all.

## Non-goals

- Animation in the email. The email image is a still.
- Organizer-authored templates or a template editor. The three templates are defined in code.
- Automatic retries or background jobs. There is no cron; the organizer re-sends what's unsent.
- Delivery tracking past "Resend accepted it": no bounce or open webhooks.
- Migrating Firestore data, which is already out of scope from the overhaul.

## Anti-goals (failure even if it "works")

- Attendees on browsers without WebGPU see a broken box or an error instead of their badge.
- An email image that looks nothing like the badge it opens.
- Going over Resend's free daily cap without the organizer knowing, so emails are quietly dropped.
- Anyone gets emailed without the organizer pressing send, including on deploy or on import.
- A badge link lets anyone list or guess other attendees' badges.

## Decided by the user

- **Badge, not certificate.** Remove:
  - the certificate PNG (`src/server/cert-image.tsx`, `cert-png.ts`, `/api/cert/...`);
  - the certificate page (`/event/$code/cert/$attendeeId`);
  - the email lookup on `/event/$code/`.
- **Shader:** the vgpu holographic-card look (vercel-labs/vgpu, MIT).
- **Templates:** all three (Graphite, Branded, ID), chosen per event.
- **Email: Resend.** Resend's **scheduled sending** handles the free cap of 100 a day; no
  Cloudflare cron.
- **Unsent and failed emails:** organizers check for them and re-send by hand.
- **Animated download:** multiple format options.
- **Plan:** stay free (no Workers Paid).
- **Email image:** the organizer chooses **Rendered** (shader) or **Simple** (no shader), and the
  shader choice carries a disclaimer.

## Constraints

- **Workers Free:** 10 ms CPU per request and no GPU. The server never renders images; all
  rendering happens in a browser.
- **Resend Free:**
  - 3,000 emails a month and 100 a day.
  - Scheduled emails go at most 30 days ahead.
  - A batch send carries at most 100 emails.
  - Resend's docs don't say whether a scheduled email counts against the daily cap when it's
    scheduled or when it sends. This must be tested; see Email.
- **Sender domain:** sending needs a verified domain in Resend. Verifying it is a maintainer
  account action and isn't done in this work (R5).
- **WebGPU** is missing on some browsers: older Safari, some Linux and Android setups, and Firefox
  outside its supported platforms.
- **License:** the vgpu shader is MIT (copyright Vercel). Keep the license notice with the shader
  source.

## The how

### Data

- **`event`** gets:
  - `template`: `'graphite' | 'branded' | 'id'`, default `'graphite'`;
  - `accentColor`: hex, used by Branded;
  - `logoKey`: R2 key, nullable, used by Branded.
- **`attendee`** gets:
  - `emailStatus`: `'not_sent' | 'scheduled' | 'sent' | 'failed'`, default `'not_sent'`. Existing
    rows backfill to `'not_sent'`, so a deploy never emails anyone.
  - `emailScheduledFor`: nullable timestamp.
  - `emailError`: nullable text.
  - `resendId`: nullable text.
  - `badgeImageKey`: nullable R2 key of the uploaded email image.
  - `badgeImageVersion`: the `event.updatedAt` the image was rendered from, so the dashboard can
    flag stale images after an edit.
- *(my call)* Email status lives on the attendee row, with no outbox table.

### Badge rendering (client)

- **One shader for all templates**, derived from vgpu's `shader.wgsl`:
  - a `mode` uniform switches the triangle on or off;
  - an `accent` uniform tints the graphite.
- **Spike files.** A throwaway spike proved this compiles and renders. They're in
  `docs/superpowers/specs/assets/badge-spike/`:
  - `spike.wgsl`: the adapted shader;
  - `spike-template.html`: the spike page;
  - `mode0.png`: a Dawn render of Graphite.

  The original source is vgpu's `apps/docs/examples/holographic-card/`.
- **Lettering is drawn at runtime.** Text is drawn on a 2D canvas (Geist and Geist Mono) into a
  1024×1456 `r8unorm` mask that covers the card exactly. The Branded logo and the ID QR code go into
  the same mask, so any name works and nothing is baked ahead of time.
  - Per-template layouts are in the spike (`mask(mode)` in `spike-template.html`); the builder
    polishes them.
  - Long names shrink to fit, then wrap to two lines.
- **One shared layout module.** The same lettering layout feeds all of these, so they always match:
  - the live shader;
  - the **Simple** flat badge, drawn on a plain 2D canvas with graphite fill, outline and text, no
    shader;
  - the PNG download;
  - the export frames.
- **Interaction:**
  - Pointer and touch mapping comes from vgpu's `renderer.ts`: approach to reveal, tilt, and the
    light follows the pointer.
  - *(my call)* An idle sweep plays when nobody is touching the card, so the page stays alive on
    phones before the first touch.
  - `prefers-reduced-motion` disables the tilt and the idle sweep.
- *(my call)* **Library:** use the `vgpu` npm package if its WGSL import works under TanStack Start
  and the Cloudflare Vite plugin; otherwise use plain WebGPU as in the spike. The shader is the
  asset either way.
- **Remove:**
  - three, @react-three/*, rapier;
  - `badge-3d.tsx`, `badge-texture.ts` and `public/models/tag.glb`, which settles the tag.glb
    licensing question;
  - `@cf-wasm/og`, since nothing renders on the server any more.
- *(my call)* **No-WebGPU fallback:**
  - Show the Simple flat badge, drawn in the attendee's browser with 2D canvas.
  - Add a CSS tilt and gradient sheen on pointer move.
  - Show a one-line note that the holographic version needs a newer browser.
  - The PNG download still works (flat); the animated export is hidden.

### Email image (organizer's browser, uploaded to R2)

- When the organizer presses **Send badges**, their browser:
  1. renders each pending attendee's image;
  2. uploads it to R2 through an owner-checked server function;
  3. asks the server to send.
- **Rendered:** the live shader at a fixed, flattering pose, with the foil revealed and the light
  across the upper third. This option shows a disclaimer:

  > Uses your browser's GPU (WebGPU). Keep this tab open while badges render (about N seconds for
  > this list).

  When WebGPU is missing, the disclaimer adds "Not available in this browser" and the option is
  disabled.
- **Simple:** the flat 2D-canvas badge. It works in every browser and is quick.
  - *(my call)* The default is Rendered when WebGPU is available, and Simple otherwise.
- **Serving:**
  - Images are PNG, about 600×853 CSS px at 2×, served from R2 through a public route keyed on the
    attendee ID.
  - The same image is the badge page's `og:image`.
  - Before an image exists, the badge page renders client-side as usual and `og:image` falls back
    to a generic certi image.

### Email (server)

- **Transport:** Resend's HTTP API via `fetch` from the Worker.
  - Secrets: `RESEND_API_KEY`, `RESEND_FROM`.
  - Var: `RESEND_DAILY_LIMIT`, default `100`.
- **HTML email:** a single responsive table layout containing:
  - the event title;
  - the attendee's name;
  - the badge image, linked to the badge page;
  - a "View your badge" button.

  *(my call)* Build it with React Email rendered to static HTML; a hand-written template is fine if
  React Email doesn't run on Workers.
- **Send badges (server side):**
  1. Take the event's `not_sent` and `failed` attendees that have an uploaded image.
  2. Fill day slots under `RESEND_DAILY_LIMIT`:
     - today gets whatever is left after the account's emails already sent or scheduled for today,
       across all events;
     - each later day gets up to the full limit.
  3. Send today's slot immediately. Send each later day as one Resend batch call with
     `scheduled_at` set to that day.
  4. Mark rows `scheduled` or `sent` and store `resendId`. Mark rejected emails `failed`, with the
     error.
  5. If the list needs more than 30 days of slots, the excess stays `not_sent` and the UI says so.
- **First build step: prove the cap behavior.** Test with a real Resend account whether scheduled
  emails count when they're scheduled or when they send.
  - If they count when scheduled, the future days get rejected immediately and land as `failed`
    with Resend's error, so nothing is lost silently.
  - In that case, fall back to "send today's slot only; the organizer presses Send again tomorrow".
    The UI shows "N left — send again tomorrow".
- *(my call)* **Testing without a verified domain:**
  - `EMAIL_MODE=log` is the default in dev and tests. It records the Resend payload instead of
    calling Resend.
  - `EMAIL_MODE=resend` sends for real.
  - Until the domain is verified, real test sends go to Resend's `delivered@resend.dev` or to the
    account owner's own address.
- **Late additions:** attendees added after sending stay `not_sent` and show up in the unsent
  count. The organizer presses Send again, or uses **Resend** on one row.

### Badge page

- **Route:** `/event/$code/badge/$attendeeId`, public.
  - The unguessable `nanoid(10)` attendee ID is the access token, as today.
  - The page shows no email address.
- **Downloads:** all client-side, rendered from the same scene.
  - **PNG:** the current frame at 2× (1080×1536).
  - **Animated:** a 4-second seamless loop along the idle sweep path. Frames are rendered from the
    shader at a fixed timestep, so the output doesn't depend on the device's frame rate.

    | Format | Size | Frame rate | Encoder | Label |
    | --- | --- | --- | --- | --- |
    | MP4 (H.264) | 1080×1536 | 30 fps | WebCodecs + an MP4 muxer | "for Instagram / TikTok / X" |
    | Animated WebP | 720×1024 | ~24 fps | WASM encoder, lazy-loaded on click | — |
    | GIF | 540×768 | ~20 fps | lazy-loaded, per-frame or global palette | — |

    - The builder picks the encoder libraries.
    - Each format is hidden when its encoder is unsupported (e.g. MP4 when WebCodecs H.264 encoding
      is unavailable).
    - Exports show progress and can be cancelled.
- **Old certificate URLs** just 404. The new app has never been deployed and starts on fresh data,
  so no live links point at it.
- **`/event/$code/`** becomes a simple public event page with no lookup form, or redirects home
  *(builder's choice)*.

### Dashboard

- **Event form:**
  - a template picker with a live preview, using the same badge component;
  - for Branded, an accent color and a logo upload. The logo is stored in R2 (PNG or SVG,
    size-capped), and SVG is sanitized or rasterized on upload.
- **Attendee table:**
  - an email status column: not sent / scheduled for a date / sent / failed with the reason;
  - a per-row **Resend** action;
  - a "badge image out of date" marker when the event changed after the image was rendered.
- **Event page:**
  - a summary, e.g. "180 sent · 100 scheduled for Oct 30 · 20 not sent · 3 failed";
  - a **Send badges** button. It opens a dialog with the **Rendered / Simple** choice and its
    disclaimer, shows render and upload progress, then shows the scheduling summary.

## Left to the builder

- Typography, spacing and layout polish within each template.
- The idle-sweep path and timing.
- React Email or a hand-written HTML template.
- Logo size and format limits.
- The encoder libraries for WebP, GIF and the MP4 muxer.
- Whether `/event/$code/` redirects home or shows a simple event page.
