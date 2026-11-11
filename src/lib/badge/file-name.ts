const MAX_SLUG = 40;

export function badgeFileName(
  firstName: string,
  lastName: string,
  eventCode: string,
  ext: string,
): string {
  const slug = `${firstName} ${lastName}`
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG)
    .replace(/-+$/g, "");
  return `${slug || "badge"}-${eventCode}.${ext}`;
}
