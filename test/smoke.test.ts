import { env } from "cloudflare:workers";
import { expect, it } from "vitest";

it("has D1 and R2 bindings", () => {
  expect(env.DB).toBeDefined();
  expect(env.BUCKET).toBeDefined();
});
