export const DEFAULT_REDIRECT = "/dashboard";

// Only same-origin relative paths pass: `//host` and `/\host` are treated as
// absolute URLs by browsers, and control characters can hide either.
export function safeRedirect(path: unknown): string {
  if (typeof path !== "string" || !path.startsWith("/")) return DEFAULT_REDIRECT;
  if (path[1] === "/" || path[1] === "\\") return DEFAULT_REDIRECT;
  for (const char of path) {
    const code = char.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f || char === "\\") return DEFAULT_REDIRECT;
  }
  return path;
}
