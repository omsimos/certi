// Order matters: Facebook's webview can also carry other tokens, so check it first.
const RULES: ReadonlyArray<readonly [name: string, test: (ua: string) => boolean]> = [
  ["Facebook", (ua) => /FBAN|FBAV|FB_IAB/i.test(ua)],
  ["Instagram", (ua) => /Instagram/i.test(ua)],
  ["LinkedIn", (ua) => /LinkedInApp/i.test(ua)],
  // Mobile Chrome/Safari never send `GSA/`; the Google app's webview does.
  ["Google app", (ua) => /GSA\//.test(ua) && /Mobile/i.test(ua)],
  ["X", (ua) => /Twitter/i.test(ua)],
  ["TikTok", (ua) => /musical_ly|BytedanceWebview|TikTok/i.test(ua)],
];

export function inAppBrowserName(userAgent: string): string | null {
  for (const [name, test] of RULES) if (test(userAgent)) return name;
  return null;
}
