import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    cloudflareTest({
      // A stub main: the TanStack server entry can't load inside the test pool.
      main: "./test/stub-worker.ts",
      miniflare: {
        compatibilityFlags: ["nodejs_compat"],
        d1Databases: ["DB"],
        r2Buckets: ["BUCKET"],
      },
    }),
  ],
  test: {
    include: ["test/**/*.test.ts"],
  },
});
