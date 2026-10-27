# Certi Stack Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Certi (event e-certificates + 3D badges) from Next.js 14 + Firebase onto TanStack Start on Cloudflare Workers, with organizer accounts, server-side data access, and server-rendered certificate images.

**Architecture:** One TanStack Start app deployed as a single Cloudflare Worker. All data access goes through server functions that call small, pure-ish domain modules (`src/server/*`) taking a Drizzle `DB` as their first argument, so they are tested directly against a real D1 in `@cloudflare/vitest-pool-workers`. Organizers sign in with Better Auth (Google/GitHub) and own their events; attendees stay anonymous and look up certificates by email. Certificate PNGs render on the Worker with Satori/resvg and are cached in R2.

**Tech Stack:** Bun, TanStack Start (React 19, Vite), `@cloudflare/vite-plugin`, Wrangler, Cloudflare D1 + R2, Drizzle ORM (`drizzle-orm/d1`) + drizzle-kit, Better Auth, Tailwind CSS v4, shadcn/ui on Base UI, react-hook-form + zod, `@cf-wasm/og` (Satori + resvg), three / `@react-three/fiber` v9 / drei / rapier, oxlint + oxfmt, Vitest + `@cloudflare/vitest-pool-workers`.

**Spec:** No separate spec doc. The decisions below were agreed in conversation on 2026-10-27 and are the spec.

### Decisions (the spec)

- Rewrite in place in `omsimos/certi` on branch `refactor/stack-overhaul` off `main`.
- Host: Cloudflare Workers (free plan to start). DB: D1. Files: R2.
- Framework: TanStack Start (replaces Next.js). UI: Tailwind v4 + shadcn/ui generated on Base UI (replaces Radix). Lint/format: oxlint + oxfmt (replaces ESLint + Prettier).
- Data: start fresh. No Firestore migration.
- Access: any signed-in organizer can create events and only the owner can edit them or import attendees. This replaces the shared `NEXT_PUBLIC_TEMP_CREDENTIAL` password.
- Login: Google and GitHub OAuth only. No password login (scrypt exceeds the free-plan CPU budget).
- Certificate: rendered server-side as a PNG (download + `og:image`), replacing `html-to-image`.
- 3D badge: port to r3f v9 on WebGL, then a time-boxed spike to run it on three's `WebGPURenderer` (WebGPU with automatic WebGL2 fallback). The badge always renders on the viewer's GPU; no server GPU is involved.

## Global Constraints

- Package manager: `bun`. Commit `bun.lock` (text lockfile); delete `bun.lockb`.
- Runtime: Cloudflare Workers, `compatibility_flags: ["nodejs_compat"]`, `compatibility_date` = date of Task 1.
- Wrangler bindings: D1 `DB` (database_name `certi`, `migrations_dir: "drizzle"`), R2 `BUCKET` (bucket_name `certi-certs`).
- Read bindings only via `import { env } from "cloudflare:workers"` in server code. Never in client code.
- Secrets (`.dev.vars` locally, `wrangler secret put` in prod): `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`. No `VITE_*` secrets.
- Free-plan CPU budget is 10 ms per request. Never parse spreadsheets on the server. Never hash passwords. Render each certificate PNG at most once per event version (R2 cache).
- Validation values (single source: `src/lib/schemas.ts`):
  - event `code`: `/^[a-z0-9-]{3,32}$/`, immutable after creation
  - `title`: 2–60 chars; `description`: 25–250; `organizer`: 2–40; `date`: `YYYY-MM-DD`
  - attendee `firstName` / `lastName`: 1–60 chars after trim; `email`: valid email, stored trimmed and lowercased
  - max 2000 attendees per import
- Attendee IDs (public certificate IDs) are `nanoid(10)`. Event IDs are `nanoid()`.
- Timestamps are Drizzle `integer({ mode: "timestamp_ms" })`.
- Commits follow Conventional Commits (`type(scope): subject`, subject line only).

## Review Focus

1. **Email casing/whitespace.** An attendee imported as `Ana@X.com ` must be found when they type ` ana@x.com`. Covered by normalization tests in Task 6 (`parseAttendeeRows` and `findAttendeeByEmail`).
2. **Re-importing the same sheet.** Organizers will upload twice. Expect no duplicate attendees and a "N added, M already existed" toast. Covered by the `unique(eventId, email)` constraint and the re-import test in Task 6.
3. **Calling another organizer's server functions directly.** UI hiding is not enough. `updateEvent`, `importAttendees`, `listAttendees` and `deleteAttendee` must throw `ForbiddenError` for non-owners. Covered by the non-owner tests in Tasks 5 and 6.
4. **Real-world spreadsheet headers.** `First Name`, `first_name`, `FIRSTNAME`, extra columns and blank trailing rows must all import. Covered by the header-normalization tests in Task 6.
5. **Long or non-Latin names on the PNG.** `María José Ñúñez-Kowalczyk` and `李小龙` must render without tofu boxes or overflow. Covered by the manual render check in Task 9, which loads a CJK fallback font.

---

## File Structure

```
wrangler.jsonc                 Worker config + D1/R2 bindings
vite.config.ts                 cloudflare() + tanstackStart() + react() + tailwindcss()
vitest.config.ts               workers pool, D1 + R2 bindings, migrations
drizzle.config.ts              drizzle-kit → ./drizzle (sqlite/d1)
.oxlintrc.json / .oxfmtrc.json lint + format (tailwind sorting on)
.dev.vars.example              documented secrets
drizzle/                       generated SQL migrations
public/                        band.jpg, Geist_Regular.json, models/tag.glb
src/
  router.tsx                   createRouter
  styles.css                   tailwind v4 entry + theme tokens
  routes/
    __root.tsx                 html shell, theme script, Navbar, Toaster, BrowserWarn
    index.tsx                  landing
    login.tsx                  Google/GitHub buttons
    dashboard.tsx              auth guard layout (beforeLoad, renders <Outlet/>)
    dashboard/index.tsx        my events
    dashboard/new.tsx          create event
    dashboard/$code.tsx        tabs: participants | details
    event/$code/index.tsx      public landing + email lookup
    event/$code/cert.$attendeeId.tsx   certificate page
    event/$code/badge.$attendeeId.tsx  3D badge page
                               (no event/$code/route.tsx, so these are siblings, not nested)
    api/auth/$.ts              Better Auth handler
    api/cert/$code.$attendeeId.ts      PNG
  db/
    index.ts                   getDb(), DB type
    schema.ts                  event, attendee (+ re-export auth tables)
    auth-schema.ts             user, session, account, verification
  lib/
    auth.ts                    betterAuth instance (server)
    auth-client.ts             createAuthClient (client)
    schemas.ts                 zod schemas + inferred types
    errors.ts                  NotFoundError, ForbiddenError, EventCodeTakenError
    theme.ts                   theme script + useTheme
    utils.ts                   cn()
  server/
    events.ts                  event domain functions
    attendees.ts               attendee domain + parseAttendeeRows
    cert-png.ts                getCertificatePng (cache logic)
    cert-image.tsx             renderCertificatePng (satori JSX)
    fns.ts                     createServerFn wrappers + authMiddleware
  components/
    ui/                        shadcn (Base UI) generated
    navbar.tsx, toggle-theme.tsx, browser-warn.tsx, find-event-dialog.tsx
    event-form.tsx, add-participants.tsx, attendee-table.tsx
    certificate-card.tsx
    badge/badge-3d.tsx, badge/badge-texture.ts
test/
  setup.ts                     applyD1Migrations
  helpers.ts                   createTestUser(), createTestEvent()
  stub-worker.ts               minimal main for the pool
  *.test.ts
```

---

### Task 1: Scaffold TanStack Start on Workers with tooling and CI

Replaces Next.js and Firebase. The deliverable is an empty app that runs, lints, type-checks, tests and builds.

**Files:**
- Delete: `next.config.mjs`, `.eslintrc.json`, `.prettierrc`, `postcss.config.js`, `tailwind.config.ts`, `bun.lockb`, `src/config/firebase.ts`, `src/hooks/use-attendees-store.tsx`, `src/hooks/use-dialog-store.tsx`, `public/next.svg`, `public/vercel.svg`
- Move aside: `src/app/` → `legacy/app/`, `src/components/` → `legacy/components/`, `src/hooks/` → `legacy/hooks/` (porting reference only; excluded from `tsconfig.json`, oxlint and oxfmt; deleted in Task 12)
- Create: `wrangler.jsonc`, `vite.config.ts`, `vitest.config.ts`, `.oxlintrc.json`, `.oxfmtrc.json`, `src/router.tsx`, `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/styles.css`, `src/lib/utils.ts`, `test/stub-worker.ts`, `test/smoke.test.ts`, `.dev.vars.example`
- Modify: `package.json`, `tsconfig.json`, `.gitignore` (add `.wrangler/`, `.dev.vars`, `worker-configuration.d.ts` stays committed), `.github/workflows/*.yml`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` in `src/lib/utils.ts`; scripts `dev build preview deploy cf-typegen lint format format:check typecheck test db:generate db:migrate:local db:migrate:remote`

- [ ] **Step 1: Branch**

```bash
git checkout main && git pull && git checkout -b refactor/stack-overhaul
```

- [ ] **Step 2: Generate a reference scaffold outside the repo** and copy its `vite.config.ts`, `wrangler.jsonc`, `src/router.tsx`, `src/routes/__root.tsx` and `package.json` scripts/deps into the repo.

```bash
cd /tmp && bun create cloudflare@latest certi-ref -- --framework=tanstack-start --no-deploy --no-git
```

`vite.config.ts` plugin order: `cloudflare({ viteEnvironment: { name: "ssr" } })`, `tanstackStart()`, `react()`, `tailwindcss()` (from `@tailwindcss/vite`). `wrangler.jsonc`: `main: "@tanstack/react-start/server-entry"`, `observability.enabled: true`, plus the `DB` and `BUCKET` bindings from Global Constraints (use placeholder `database_id: "local"` until Task 12).

- [ ] **Step 3: Replace dependencies.** Remove every `next*`, `firebase`, `react-firebase-hooks`, `@radix-ui/*`, `zustand`, `html-to-image`, `modern-screenshot`, `leva`, `eslint*`, `prettier*`, `autoprefixer`, `postcss`, `tailwindcss-animate`. Keep `zod` (upgrade to v4), `react-hook-form`, `@hookform/resolvers`, `nanoid`, `sonner`, `lucide-react`, `clsx`, `tailwind-merge`, `xlsx`, `react-parallax-tilt`, `vaul` (until Task 2 decides). Add dev: `oxlint`, `oxfmt` (≥0.35.0), `vitest` + `@cloudflare/vitest-pool-workers` (use the vitest major the pool's peer dependency requires), `@tailwindcss/vite`, `tailwindcss@4`.

- [ ] **Step 4: Configure oxfmt** with `sortTailwindcss: { stylesheet: "./src/styles.css", functions: ["cn", "cva", "clsx"] }`, and oxlint with the `react`, `typescript`, `import` plugins.

- [ ] **Step 5: Configure Vitest** using the workers pool with `main: "./test/stub-worker.ts"` (do not point it at the TanStack server entry), `miniflare: { d1Databases: ["DB"], r2Buckets: ["BUCKET"], compatibilityFlags: ["nodejs_compat"] }`. Follow the README of the installed `@cloudflare/vitest-pool-workers` version for the config helper name.

- [ ] **Step 6: Write the smoke test** `test/smoke.test.ts`

```ts
import { env } from "cloudflare:test";
it("has D1 and R2 bindings", () => {
  expect(env.DB).toBeDefined();
  expect(env.BUCKET).toBeDefined();
});
```

- [ ] **Step 7: Index route** renders `<h1>Certi</h1>` (placeholder; real landing in Task 2).

- [ ] **Step 8: Verify everything runs**

Run: `bun install && bun run cf-typegen && bun run lint && bun run format:check && bun run typecheck && bun run test && bun run build`
Expected: all exit 0; the test reports `1 passed`.
Run: `bun run dev`, then `curl -s localhost:<port>/ | grep Certi`
Expected: a match.

- [ ] **Step 9: CI.** Rewrite the workflow to run on Node 24 with `oven-sh/setup-bun@v2`: `bun install --frozen-lockfile`, `bun run cf-typegen`, `lint`, `format:check`, `typecheck`, `test`, `build`.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "refactor: replace next.js and firebase with tanstack start on workers"
```

---

### Task 2: UI foundation (Tailwind v4, shadcn on Base UI, theme, shell, landing)

**Files:**
- Create: `components.json` (regenerated), `src/components/ui/*`, `src/lib/theme.ts`, `src/components/navbar.tsx`, `src/components/toggle-theme.tsx`, `src/components/browser-warn.tsx`, `src/components/find-event-dialog.tsx`, `src/components/magicui/*` (port), `src/routes/index.tsx`
- Modify: `src/routes/__root.tsx`, `src/styles.css`
- Reference: `legacy/app/page.tsx`, `legacy/app/globals.css`, `legacy/components/*`

**Interfaces:**
- Produces: `themeScript: string` and `useTheme(): { theme: "light" | "dark" | "system"; setTheme(t): void }` in `src/lib/theme.ts`. Shadcn components at `@/components/ui/<name>`: `button input textarea label card dialog alert-dialog drawer select tabs table tooltip separator sonner field`.

- [ ] **Step 1: Generate the components.** Run `bunx shadcn@latest init`, choose **Base UI** as the primitive library and Tailwind v4, then `bunx shadcn@latest add` the list above. If shadcn's Base UI set has no `drawer`, keep `vaul` for the mobile Find Event drawer. Otherwise drop `vaul`.

- [ ] **Step 2: Port the theme tokens** from `legacy/app/globals.css` into `src/styles.css` as v4 `@theme` / CSS variables. Keep the existing zinc palette and the `retro-grid` and `shiny-text` keyframes.

- [ ] **Step 3: Write `src/lib/theme.ts`.** `themeScript` is an IIFE string that reads `localStorage.theme` (falling back to `prefers-color-scheme`) and toggles the `dark` class on `<html>` before paint. Inject it in `__root.tsx` `<head>` via TanStack Router's `<ScriptOnce>`, and set `suppressHydrationWarning` on `<html>`. This replaces `next-themes`.

- [ ] **Step 4: Write the root shell** in `__root.tsx`: `head()` with title `Certi`, the Geist font via `<link>`, then `<Navbar/>`, `<Outlet/>`, `<Toaster/>` and `<BrowserWarn/>` (port as is). The Navbar shows the brand link, the theme toggle, and a slot for the auth button (wired in Task 4). `notFoundComponent` renders the ported 404.

- [ ] **Step 5: Port the landing page.** `EventButtons` becomes `find-event-dialog.tsx`: a Dialog on desktop and a Drawer on mobile, navigating to `/event/$code` via `useNavigate`. The "Setup Event" button links to `/dashboard/new`. Remove the hard-coded `hacking-ai` default and the experimental badge link.

- [ ] **Step 6: Verify the shell**

Run: `bun run dev`, open `/`, toggle the theme, reload.
Expected: the landing matches the legacy look, the theme persists with no flash, and Find Event opens.
Run: `bun run lint && bun run typecheck && bun run build`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(ui): add base ui components, theme, and landing page"
```

---

### Task 3: D1 schema with Drizzle

**Files:**
- Create: `src/db/schema.ts`, `src/db/auth-schema.ts`, `src/db/index.ts`, `drizzle.config.ts`, `drizzle/0000_*.sql`, `test/setup.ts`, `test/helpers.ts`, `test/schema.test.ts`
- Modify: `vitest.config.ts` (setup file + `TEST_MIGRATIONS` binding)

**Interfaces:**
- Produces:
  - `getDb(d1: D1Database): DB` and `type DB = DrizzleD1Database<typeof schema>` in `src/db/index.ts`
  - Tables (`src/db/schema.ts`):
    - `event`: `id` text pk; `code` text unique not null; `title`, `description`, `organizer`, `date` text not null; `ownerId` text not null → `user.id` on delete cascade; `createdAt`, `updatedAt` timestamp_ms not null
    - `attendee`: `id` text pk; `eventId` text not null → `event.id` on delete cascade; `firstName`, `lastName`, `email` text not null; `createdAt` timestamp_ms; `uniqueIndex("attendee_event_email").on(eventId, email)`; `index("attendee_event").on(eventId)`
  - `type Event = typeof event.$inferSelect` and `type Attendee = typeof attendee.$inferSelect`
  - `createTestUser(db: DB, overrides?): Promise<{ id: string }>` and `createTestEvent(db: DB, ownerId: string, overrides?): Promise<Event>` in `test/helpers.ts`

- [ ] **Step 1: Write the auth schema by hand.** Copy Better Auth's "Core Schema" tables (`user`, `session`, `account`, `verification`) into `src/db/auth-schema.ts` using `sqliteTable`. Don't use the Better Auth CLI generator: it can't import `cloudflare:workers`.

- [ ] **Step 2: Write the failing test** `test/schema.test.ts`

```ts
it("rejects a duplicate attendee email within one event", async () => {
  const db = getDb(env.DB);
  const user = await createTestUser(db);
  const ev = await createTestEvent(db, user.id);
  const row = { eventId: ev.id, firstName: "A", lastName: "B", email: "a@b.co" };
  await db.insert(attendee).values({ id: "x1", ...row });
  await expect(db.insert(attendee).values({ id: "x2", ...row })).rejects.toThrow();
});
it("allows the same email in different events", async () => { /* two events, same email → both inserts resolve */ });
it("cascades attendees when an event is deleted", async () => { /* delete event → attendee count 0 */ });
```

- [ ] **Step 3: Run it to verify it fails**

Run: `bun run test test/schema.test.ts`
Expected: FAIL (module or tables missing).

- [ ] **Step 4: Implement the schema, `getDb`, and `drizzle.config.ts`** (`dialect: "sqlite"`, `out: "./drizzle"`, `schema: "./src/db/schema.ts"`). Then run `bun run db:generate`. In `test/setup.ts`, call `applyD1Migrations(env.DB, env.TEST_MIGRATIONS)`, with `TEST_MIGRATIONS` filled from `readD1Migrations("./drizzle")` in `vitest.config.ts`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun run test test/schema.test.ts`
Expected: 3 passed.
Run: `bun run db:migrate:local`
Expected: the migration applies with no errors.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(db): add d1 schema for events, attendees, and auth"
```

---

### Task 4: Better Auth with Google and GitHub

**Files:**
- Create: `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/errors.ts`, `src/routes/api/auth/$.ts`, `src/routes/login.tsx`, `src/routes/dashboard.tsx`, `src/server/fns.ts`, `test/errors.test.ts`
- Modify: `src/components/navbar.tsx`, `.dev.vars.example`

**Interfaces:**
- Consumes: `getDb`, auth tables (Task 3)
- Produces:
  - `auth` in `src/lib/auth.ts`: `betterAuth({ database: drizzleAdapter(getDb(env.DB), { provider: "sqlite", schema }), socialProviders: { google, github }, plugins: [tanstackStartCookies()] })`, with `tanstackStartCookies` from `better-auth/tanstack-start`
  - `authClient` in `src/lib/auth-client.ts`, exposing `signIn.social({ provider, callbackURL })`, `signOut()` and `useSession()`
  - In `src/lib/errors.ts`: `class NotFoundError extends Error`, `class ForbiddenError extends Error`, `class EventCodeTakenError extends Error`, and `assertUser(session: Session | null): User`, which throws `ForbiddenError("Sign in required")` when there's no session
  - In `src/server/fns.ts`: `authMiddleware` (`createMiddleware({ type: "function" })`), which reads `auth.api.getSession({ headers: getRequestHeaders() })` and passes `context.user` via `assertUser`; and `getSessionFn` (`createServerFn`), which returns `{ user } | null`

- [ ] **Step 1: Write the failing test** `test/errors.test.ts`. It covers `assertUser(null)` throwing `ForbiddenError` and `assertUser({ user, session })` returning `user`.

- [ ] **Step 2: Run** `bun run test test/errors.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** `errors.ts`, `auth.ts`, `auth-client.ts`, and the API route. The route uses `createFileRoute("/api/auth/$")({ server: { handlers: { GET, POST } } })`, and both handlers return `auth.handler(request)`.

- [ ] **Step 4: Add the guard and login page.** `dashboard.tsx` is a layout route rendering `<Outlet/>` with a `beforeLoad` that calls `getSessionFn()`; with no session it throws `redirect({ to: "/login", search: { redirect: location.href } })`. `login.tsx` shows "Continue with Google" and "Continue with GitHub" buttons that call `authClient.signIn.social` with `callbackURL` set to `search.redirect ?? "/dashboard"`. The Navbar shows "Sign in", or the user's avatar with a menu containing Dashboard and Sign out.

- [ ] **Step 5: Run** `bun run test test/errors.test.ts`. Expected: PASS.

- [ ] **Step 6: Manual OAuth check.** Create Google and GitHub OAuth apps with callbacks `http://localhost:<port>/api/auth/callback/google` and `…/github`, and fill in `.dev.vars`.

Run: `bun run dev`, then sign in with each provider.
Expected: you land on `/dashboard`, a `user` row exists (`bunx wrangler d1 execute certi --local --command "select email from user"`), sign out works, and visiting `/dashboard` while signed out redirects to `/login`.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(auth): add better auth with google and github sign-in"
```

---

### Task 5: Event domain

**Files:**
- Create: `src/lib/schemas.ts`, `src/server/events.ts`, `test/events.test.ts`
- Modify: `src/server/fns.ts`

**Interfaces:**
- Consumes: `DB`, `event`, `Event` (Task 3); errors and `authMiddleware` (Task 4)
- Produces:
  - In `src/lib/schemas.ts`: `eventCodeSchema`, `eventInputSchema` (`{ code, title, description, organizer, date }`), `eventUpdateSchema` (`eventInputSchema.omit({ code: true })`), and the types `EventInput` and `EventUpdate`
  - In `src/server/events.ts`:
    - `createEvent(db: DB, ownerId: string, input: EventInput): Promise<Event>`, which throws `EventCodeTakenError`
    - `updateEvent(db: DB, ownerId: string, code: string, input: EventUpdate): Promise<Event>`, which throws `NotFoundError` or `ForbiddenError`, and sets `updatedAt = new Date()`
    - `getEventByCode(db: DB, code: string): Promise<Event | null>`
    - `getOwnedEvent(db: DB, ownerId: string, code: string): Promise<Event>`, which throws `NotFoundError` or `ForbiddenError`
    - `listEventsByOwner(db: DB, ownerId: string): Promise<Event[]>`, newest `createdAt` first
  - Server functions in `fns.ts`, each validating input with zod (`.inputValidator`) and using `authMiddleware` where it says so:
    - `createEventFn` (auth)
    - `updateEventFn` (auth)
    - `getEventFn({ code })` (public, returns `Event | null`)
    - `listMyEventsFn` (auth)
    - `getOwnedEventFn({ code })` (auth)

- [ ] **Step 1: Write the failing tests** `test/events.test.ts`

```ts
it("creates an event owned by the user", async () => { /* createEvent → code/ownerId match, getEventByCode returns it */ });
it("rejects a taken code", async () => {
  await createEvent(db, a.id, input);
  await expect(createEvent(db, b.id, input)).rejects.toBeInstanceOf(EventCodeTakenError);
});
it("lets the owner update and bumps updatedAt", async () => { /* updatedAt > before, title changed */ });
it("forbids non-owners from updating", async () => {
  await expect(updateEvent(db, b.id, ev.code, upd)).rejects.toBeInstanceOf(ForbiddenError);
});
it("throws NotFoundError for an unknown code", async () => { /* updateEvent(db, a.id, "nope-123", upd) */ });
it("lists only the owner's events, newest first", async () => { /* 2 for a, 1 for b → a sees 2 in desc order */ });
it("schema rejects codes with spaces or uppercase", () => {
  expect(eventCodeSchema.safeParse("My Event").success).toBe(false);
  expect(eventCodeSchema.safeParse("devfest-24").success).toBe(true);
});
```

- [ ] **Step 2: Run** `bun run test test/events.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** `schemas.ts` (values from Global Constraints), `events.ts`, and the server functions. To detect a taken code, catch the D1 `UNIQUE constraint failed: event.code` error. Don't do a pre-check select, because it races.

- [ ] **Step 4: Run** `bun run test test/events.test.ts`. Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(events): add owner-scoped event domain and server functions"
```

---

### Task 6: Attendee domain (parsing, import, lookup)

**Files:**
- Create: `src/server/attendees.ts`, `test/parse-attendees.test.ts`, `test/attendees.test.ts`
- Modify: `src/lib/schemas.ts`, `src/server/fns.ts`

**Interfaces:**
- Consumes: Task 5's `getOwnedEvent` and errors; Task 3's `attendee` and `Attendee`
- Produces:
  - In `src/lib/schemas.ts`: `attendeeInputSchema` (`{ firstName, lastName, email }`, trimmed, email lowercased) and `type AttendeeInput`
  - In `src/server/attendees.ts`:
    - `parseAttendeeRows(rows: unknown[]): { attendees: AttendeeInput[]; errors: { row: number; message: string }[]; duplicates: number }`. It is pure and runs on the client. `row` is the 1-based data row.
    - `importAttendees(db: DB, ownerId: string, code: string, attendees: AttendeeInput[]): Promise<{ inserted: number; skipped: number }>`
    - `listAttendees(db: DB, ownerId: string, code: string): Promise<Attendee[]>`, ordered by `lastName`
    - `deleteAttendee(db: DB, ownerId: string, code: string, attendeeId: string): Promise<void>`
    - `findAttendeeByEmail(db: DB, code: string, email: string): Promise<{ id: string } | null>`
    - `getCertificate(db: DB, code: string, attendeeId: string): Promise<{ attendee: Attendee; event: Event } | null>`
  - Server functions:
    - `importAttendeesFn`, `listAttendeesFn` and `deleteAttendeeFn` (auth)
    - `findAttendeeFn({ code, email })` (public)
    - `getCertificateFn({ code, attendeeId })` (public)

Header normalization rule: lowercase the header and strip all non-alphanumerics. Then map:
- `firstname` or `first` → `firstName`
- `lastname`, `last` or `surname` → `lastName`
- `email`, `emailaddress` or `mail` → `email`

Ignore other columns. Skip rows whose mapped values are all empty.

- [ ] **Step 1: Write the failing parse tests** `test/parse-attendees.test.ts`

```ts
it("normalizes headers, trims, lowercases email", () => {
  const r = parseAttendeeRows([{ "First Name": " Ana ", last_name: "Cruz", Email: " Ana@X.com ", Org: "x" }]);
  expect(r).toEqual({ attendees: [{ firstName: "Ana", lastName: "Cruz", email: "ana@x.com" }], errors: [], duplicates: 0 });
});
it("skips fully blank rows", () => { /* [{...valid}, { firstName: "", email: "" }] → 1 attendee, 0 errors */ });
it("reports invalid email with its row", () => {
  expect(parseAttendeeRows([valid, { firstName: "B", lastName: "C", email: "nope" }]).errors)
    .toEqual([{ row: 2, message: "Invalid email" }]);
});
it("dedupes by email within the file", () => { /* same email twice, different case → 1 attendee, duplicates: 1 */ });
it("rejects names longer than 60 chars", () => { /* errors[0].row === 1 */ });
it("rejects more than 2000 rows", () => { /* 2001 valid rows → attendees [], errors [{ row: 0, message: "Too many rows (max 2000)" }] */ });
```

- [ ] **Step 2: Write the failing DB tests** `test/attendees.test.ts`

```ts
it("imports and reports counts", async () => { expect(await importAttendees(db, a.id, ev.code, two)).toEqual({ inserted: 2, skipped: 0 }); });
it("skips existing emails on re-import", async () => { /* second call → { inserted: 0, skipped: 2 } */ });
it("imports 500 rows (chunking)", async () => { /* inserted: 500 */ });
it("forbids non-owners", async () => { await expect(importAttendees(db, b.id, ev.code, two)).rejects.toBeInstanceOf(ForbiddenError); });
it("forbids non-owners from listing and deleting", async () => { /* listAttendees and deleteAttendee with b.id → ForbiddenError */ });
it("finds attendees by email ignoring case and whitespace", async () => {
  expect(await findAttendeeByEmail(db, ev.code, "  ANA@x.com ")).toEqual({ id: expect.any(String) });
});
it("does not find an attendee of another event", async () => { /* same email imported into ev2 only → null for ev.code */ });
it("getCertificate returns null when attendee belongs to another event", async () => { /* … */ });
```

- [ ] **Step 3: Run** `bun run test test/parse-attendees.test.ts test/attendees.test.ts`. Expected: FAIL.

- [ ] **Step 4: Implement.** `importAttendees` inserts with `.onConflictDoNothing().returning({ id: attendee.id })` in chunks of 15 rows, so each statement stays under D1's 100-bound-parameter limit. Send the chunks in one `db.batch([...])`. `inserted` is the total number of returned rows, and `skipped = attendees.length - inserted`. IDs are `nanoid(10)`.

- [ ] **Step 5: Run the tests to verify they pass.** Expected: 14 passed.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(attendees): add attendee parsing, import, and lookup"
```

---

### Task 7: Organizer dashboard UI

**Files:**
- Create: `src/routes/dashboard/index.tsx`, `src/routes/dashboard/new.tsx`, `src/routes/dashboard/$code.tsx`, `src/components/event-form.tsx`, `src/components/add-participants.tsx`, `src/components/attendee-table.tsx`
- Reference: `legacy/app/event-setup/components/*`

**Interfaces:**
- Consumes: Task 5's event server functions and `eventInputSchema`; Task 6's `parseAttendeeRows`, `importAttendeesFn`, `listAttendeesFn` and `deleteAttendeeFn`
- Produces: `<EventForm mode="create" | "edit" event?={Event} />`

- [ ] **Step 1: `/dashboard`.** The loader calls `listMyEventsFn`. Show event cards (title, code, date, link to `/dashboard/$code`), a "New event" button, and an empty state.

- [ ] **Step 2: `EventForm`.** Use react-hook-form + `zodResolver(eventInputSchema)` with shadcn `Field` components, and add a native `type="date"` input (the legacy form never collected `date`, so certificates showed "held on undefined"). In create mode, submitting calls `createEventFn` and then navigates to `/dashboard/$code`. An `EventCodeTakenError` becomes a field error on `code`. In edit mode, `code` is disabled and submitting calls `updateEventFn` and shows a toast. The admin password dialog is gone.

- [ ] **Step 3: `/dashboard/$code`.** Set `validateSearch: z.object({ tab: z.enum(["participants", "details"]).catch("participants") })`. The loader calls `getOwnedEventFn` and `listAttendeesFn`. Map `ForbiddenError`/`NotFoundError` to `notFound()`. Tabs are bound to `search.tab` via `navigate({ search })`.

- [ ] **Step 4: `AddParticipants`.** The `.xlsx` upload (browser-side `xlsx.read` → `sheet_to_json`) and the JSON paste both go through `parseAttendeeRows`. Errors appear inline as "Row N: message". On success, a preview dialog lists the count and the first 50 rows. "Import" calls `importAttendeesFn` and toasts `${inserted} added, ${skipped} already existed`, then calls `router.invalidate()`. Keep this state local to the component (no zustand). Load `xlsx` with a dynamic `import()` so it isn't in the main bundle.

- [ ] **Step 5: `AttendeeTable`.** Columns: name, email, a copy-certificate-link action (`/event/$code/cert/$id`), and delete (with confirmation via AlertDialog).

- [ ] **Step 6: Manual verification**

Run: `bun run dev`, signed in.
Expected:
- you can create an event, and a duplicate code shows the field error;
- the details tab saves edits;
- importing a sample `.xlsx` with `First Name`/`Email` headers adds the rows, and re-importing reports "0 added, N already existed";
- a second account opening `/dashboard/<first-code>` gets the 404.

Run: `bun run lint && bun run typecheck && bun run test`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat(dashboard): add event management and attendee import ui"
```

---

### Task 8: Public event and certificate pages

**Files:**
- Create: `src/routes/event/$code/index.tsx`, `src/routes/event/$code/cert.$attendeeId.tsx`, `src/components/certificate-card.tsx`
- Reference: `legacy/app/event/components/event-landing.tsx`, `legacy/app/event/components/certificate.tsx`, `legacy/hooks/copy-to-clipboard.tsx`

**Interfaces:**
- Consumes: Task 5's `getEventFn`; Task 6's `findAttendeeFn` and `getCertificateFn`
- Produces: `<CertificateCard attendee={Attendee} event={Event} />` (the HTML ticket card)
- Produces: the PNG URL convention `/api/cert/${code}/${attendeeId}` (implemented in Task 9)

- [ ] **Step 1: `/event/$code`.** The loader calls `getEventFn` and throws `notFound()` when there's no event. `head()` sets the title and description from the event. The email form uses zod `email()` plus a type select (Certificate / Badge, defaulting to Certificate) and calls `findAttendeeFn`. When it finds a match, it navigates to `/event/$code/cert/$id` or `/event/$code/badge/$id`. Otherwise it shows the toast "No certificate found for that email". Remove the hard-coded default email `dale@ban.com`.

- [ ] **Step 2: Certificate page.** The loader calls `getCertificateFn` and throws `notFound()` when there's no result. Render `<CertificateCard>` inside `react-parallax-tilt` (the legacy ticket design, now showing `event.date`). Show a "Copy link" button, and a "Download" button that is an `<a href="/api/cert/$code/$id?download=1">`. `head()` sets `og:image` and `twitter:image` to the absolute PNG URL with `twitter:card = summary_large_image`.

- [ ] **Step 3: Manual verification**

Run: `bun run dev`, then search a known email in mixed case.
Expected: the certificate page shows the name, title, organizer and date. An unknown `attendeeId` gives a 404. The page source contains the `og:image` meta tag.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat(event): add public event lookup and certificate pages"
```

---

### Task 9: Server-rendered certificate PNG cached in R2

**Files:**
- Create: `src/server/cert-png.ts`, `src/server/cert-image.tsx`, `src/routes/api/cert/$code.$attendeeId.ts`, `test/cert-png.test.ts`

**Interfaces:**
- Consumes: Task 6's `getCertificate`
- Produces:
  - In `src/server/cert-png.ts`:
    - `certPngKey(attendeeId: string, eventUpdatedAt: Date): string`, returning `` `certs/${attendeeId}/${eventUpdatedAt.getTime()}.png` ``
    - `type CertificateData = { firstName: string; lastName: string; eventTitle: string; organizer: string; date: string; attendeeId: string }`
    - `getCertificatePng(deps: { db: DB; bucket: R2Bucket; render: (d: CertificateData) => Promise<ArrayBuffer> }, code: string, attendeeId: string): Promise<ArrayBuffer | null>`
  - `renderCertificatePng(d: CertificateData): Promise<ArrayBuffer>` in `src/server/cert-image.tsx`, producing a 1200×630 PNG

- [ ] **Step 1: Write the failing tests** `test/cert-png.test.ts`, using `env.BUCKET` and a `render` spy that returns `new Uint8Array([1, 2, 3]).buffer`

```ts
it("returns null and does not render for an unknown attendee", async () => { /* render not called */ });
it("renders once, then serves from R2", async () => {
  await getCertificatePng(deps, ev.code, id); await getCertificatePng(deps, ev.code, id);
  expect(render).toHaveBeenCalledTimes(1);
  expect(await env.BUCKET.get(certPngKey(id, ev.updatedAt))).not.toBeNull();
});
it("re-renders after the event is updated", async () => { /* updateEvent → render called twice total */ });
it("passes the event and attendee fields to render", async () => { /* toHaveBeenCalledWith({ firstName, lastName, eventTitle, organizer, date, attendeeId }) */ });
```

- [ ] **Step 2: Run** `bun run test test/cert-png.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `getCertificatePng`**: look up with `getCertificate`, then `bucket.get(key)`, otherwise render and `bucket.put(key, png, { httpMetadata: { contentType: "image/png" } })`.

- [ ] **Step 4: Run** `bun run test test/cert-png.test.ts`. Expected: 4 passed.

- [ ] **Step 5: Implement `renderCertificatePng`** with `@cf-wasm/og`'s `ImageResponse`, porting the legacy ticket layout to Satori-compatible flexbox JSX. Load Geist Regular and Bold, plus a Noto Sans SC subset as the fallback, through the package's Google Fonts helper. Font fetches count as network time, not CPU time. Check the package README for the exact helper name in the installed version. Names longer than 30 chars drop to a smaller font size.

- [ ] **Step 6: API route.** `createFileRoute("/api/cert/$code/$attendeeId")` with a `server.handlers.GET` that calls `getCertificatePng({ db: getDb(env.DB), bucket: env.BUCKET, render: renderCertificatePng }, …)`. Return 404 for `null`. Otherwise respond with `content-type: image/png` and `cache-control: public, max-age=86400`, plus `content-disposition: attachment; filename="certificate-<id>.png"` when `?download=1` is set.

- [ ] **Step 7: Manual render check** (Review Focus 5)

Import attendees `María José Ñúñez-Kowalczyk` and `李小龙`, then run `bun run dev` and open `/api/cert/<code>/<id>` for each.
Expected: correct glyphs with no overflow; the Download button saves a file; and `bunx wrangler r2 object get certi-certs/certs/<id>/<ts>.png --local --file /dev/null` succeeds.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat(cert): render certificate png on the worker and cache in r2"
```

---

### Task 10: Port the 3D badge (WebGL, r3f v9)

**Files:**
- Create: `src/components/badge/badge-3d.tsx`, `src/routes/event/$code/badge.$attendeeId.tsx`, `public/models/tag.glb`
- Reference: `legacy/app/event/[name]/badge/components/badge-3d.jsx`, `legacy/app/event/[name]/badge/components/badge-showcase.tsx`

**Interfaces:**
- Consumes: Task 6's `getCertificateFn`
- Produces: `<Badge3D attendee={{ firstName: string; lastName: string }} />`, client-only

- [ ] **Step 1: Install dependencies**: `three`, `@types/three`, `@react-three/fiber@9`, `@react-three/drei@10`, `@react-three/rapier@2`, `meshline`.

- [ ] **Step 2: Self-host the model.** Download the current `tag.glb` (the `assets.vercel.com` URL in the legacy file) into `public/models/tag.glb` and load it from there. Check its license before shipping. It's Vercel's conference badge asset, so replace it with an Omsimos model if reuse isn't allowed.

- [ ] **Step 3: Port to TSX** with typed refs. Remove `leva` (enable the rapier `debug` only under `import.meta.env.DEV`), and remove the commented-out code.

- [ ] **Step 4: Badge route.** The loader calls `getCertificateFn` (404 when missing). The page lazy-loads `Badge3D` with `React.lazy` inside `<ClientOnly fallback={<BadgeSkeleton/>}>`. On viewports narrower than 768px it shows the legacy mobile notice plus a link to the certificate.

- [ ] **Step 5: Manual verification**

Run: `bun run dev`, then open `/event/<code>/badge/<id>`.
Expected: the lanyard hangs, drags and swings with the attendee's name on the card; no requests go to `assets.vercel.com`; and `bun run build` shows three.js in a separate chunk, not in the entry chunk.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(badge): port 3d badge to r3f v9"
```

---

### Task 11: WebGPU renderer spike for the badge (time-boxed: 1 day)

Goal: render the badge with `WebGPURenderer` from `three/webgpu`, which uses WebGPU where available and falls back to WebGL2 on its own. If the time box runs out, drop the branch work and keep Task 10. Nothing else depends on this task.

**Files:**
- Create: `src/components/badge/badge-texture.ts`
- Modify: `src/components/badge/badge-3d.tsx`

**Interfaces:**
- Produces: `createBadgeTexture(attendee: { firstName: string; lastName: string }): THREE.CanvasTexture`

Known incompatibilities to replace:
- **`meshline`** uses `ShaderMaterial`, which `WebGPURenderer` doesn't support. Replace it with a mesh rebuilt each frame from `curve.getPoints(32)`, either a `TubeGeometry` or a flat ribbon, using a node material that maps `band.jpg` with `repeat [-3, 1]`.
- **drei `RenderTexture` + `Text3D`** for the name is unverified on WebGPU. Replace both with `createBadgeTexture`: draw the name and `omsimos.com` with the 2D canvas API, which works on any backend.

- [ ] **Step 1: Create the renderer** with r3f v9's async `gl` prop: `gl={async (props) => { const r = new WebGPURenderer(props); await r.init(); return r; }}`.
- [ ] **Step 2: Swap the band and texture** as described above.
- [ ] **Step 3: Verify**

Check Chrome or Edge with WebGPU, and Firefox or Safari without it.
Expected:
- `renderer.backend.isWebGPUBackend` is `true` in Chrome and `false` (WebGL2 fallback) elsewhere;
- drag, swing and the iridescent material work on both;
- frame rate is no worse than Task 10 in Chrome DevTools' performance panel.

- [ ] **Step 4: Commit if all checks pass**

```bash
git add -A && git commit -m "feat(badge): render badge with webgpu renderer and webgl2 fallback"
```

---

### Task 12: Provision, deploy, and clean up

Steps marked **(user)** need the maintainer's Cloudflare and OAuth accounts.

**Files:**
- Modify: `wrangler.jsonc` (real `database_id`), `README.md`
- Delete: `legacy/`

- [ ] **Step 1 (user): Create the resources.** Run `bunx wrangler login`, `bunx wrangler d1 create certi` (paste the `database_id` into `wrangler.jsonc`) and `bunx wrangler r2 bucket create certi-certs`.
- [ ] **Step 2 (user): Set the secrets.** Run `bunx wrangler secret put` for each secret in Global Constraints, with `BETTER_AUTH_URL` set to the production origin. Add production callback URLs to both OAuth apps.
- [ ] **Step 3: Migrate and deploy.** Run `bun run db:migrate:remote && bun run deploy`. Expected: a `*.workers.dev` URL is printed.
- [ ] **Step 4: Smoke test production.** Sign in, create an event, import 3 attendees, look one up by email, open the certificate, download the PNG, and open the badge.
- [ ] **Step 5: Check the CPU budget.** Run `bunx wrangler tail --format pretty` while requesting an uncached PNG, or read CPU time in Workers Observability. If PNG renders exceed 10 ms and return error 1102, the options are Workers Paid ($5/month) or rendering PNGs ahead of time at import. Report the measured CPU time to the maintainer; don't work around it silently.
- [ ] **Step 6: Clean up.** Delete `legacy/`. Rewrite the README (stack, local setup: `.dev.vars`, `db:migrate:local`, `dev`) and replace the stale `hyamero/certificate-generator` links. Optionally connect the repo to Workers Builds for deploys on push.
- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "chore: remove legacy code and document new setup"
```
