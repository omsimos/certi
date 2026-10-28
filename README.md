![image](https://github.com/hyamero/certificate-generator/assets/78056869/a8b0c19a-34e3-49ed-8a46-34276366b823)
![image](https://github.com/user-attachments/assets/706c43c7-9c41-408a-a5ae-1a9052af16f3)

# Certi

Event badges. An organizer creates an event and imports attendees; a WebGPU holographic badge emailed to attendees is in progress.

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

## Known limits

- **Import size.** Attendee imports are capped at 2000 rows.

## Contributing

If you wish to suggest or work on a new feature, please open an issue to discuss with the community and the project maintainers. We appreciate your interest and look forward to collaborating with you!

## License

This project is licensed under the MIT License. See the [`LICENSE`](https://github.com/omsimos/certi/blob/main/LICENSE) file for details.
