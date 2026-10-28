import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => ({
  resolve: { tsconfigPaths: true },
  plugins: [
    cloudflareTest({
      // A stub main: the TanStack server entry can't load inside the test pool.
      main: "./test/stub-worker.ts",
      miniflare: {
        compatibilityFlags: ["nodejs_compat"],
        d1Databases: ["DB"],
        r2Buckets: ["BUCKET"],
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations("./drizzle"),
          EMAIL_MODE: "log",
          RESEND_DAILY_LIMIT: "100",
        },
      },
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
  },
}));
