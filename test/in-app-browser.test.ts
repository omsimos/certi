import { describe, expect, it } from "vitest";
import { inAppBrowserName } from "@/lib/in-app-browser";

const IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko)";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/125.0.0.0 Mobile Safari/537.36";

describe("inAppBrowserName", () => {
  it.each([
    ["Facebook", `${IOS} Mobile/15E148 [FBAN/FBIOS;FBAV/460.0.0.0;FBBV/1]`],
    ["Facebook", `${ANDROID} [FB_IAB/FB4A;FBAV/450.0.0.0;]`],
    ["Instagram", `${IOS} Mobile/15E148 Instagram 330.0.0.0 (iPhone14,2)`],
    ["Instagram", `${ANDROID} Instagram 330.0.0.0 Android`],
    ["LinkedIn", `${IOS} Mobile/15E148 LinkedInApp`],
    ["Google app", `${IOS} Mobile/15E148 GSA/300.0.598994205 Safari/604.1`],
    ["X", `${IOS} Mobile/15E148 Twitter for iPhone`],
    ["TikTok", `${ANDROID} musical_ly_2023 BytedanceWebview/d8a21c6`],
    ["TikTok", `${IOS} Mobile/15E148 TikTok 33.0.0`],
  ])("detects %s", (name, ua) => {
    expect(inAppBrowserName(ua)).toBe(name);
  });

  it.each([
    [
      "desktop Chrome",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    ],
    ["mobile Safari", `${IOS} Version/17.5 Mobile/15E148 Safari/604.1`],
    ["mobile Chrome", ANDROID],
    ["GSA without Mobile", "Mozilla/5.0 (X11; Linux) GSA/300.0 Safari/537.36"],
    ["empty", ""],
  ])("returns null for %s", (_label, ua) => {
    expect(inAppBrowserName(ua)).toBeNull();
  });
});
