import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { requireEnv } from "@/lib/env";

// A provider without credentials is left out so local dev boots without
// OAuth apps; its sign-in button then fails at click time, not at import.
const google =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
    : undefined;
const github =
  env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
    ? { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET }
    : undefined;

export const auth = betterAuth({
  secret: requireEnv("BETTER_AUTH_SECRET", env.BETTER_AUTH_SECRET, import.meta.env.DEV),
  baseURL: requireEnv("BETTER_AUTH_URL", env.BETTER_AUTH_URL, import.meta.env.DEV),
  database: drizzleAdapter(getDb(env.DB), { provider: "sqlite", schema }),
  socialProviders: { google, github },
  // Must stay last so it sees cookies set by other plugins.
  plugins: [tanstackStartCookies()],
});

export type Session = typeof auth.$Infer.Session;
