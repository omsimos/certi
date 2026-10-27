// Event dates are calendar dates (YYYY-MM-DD), so format them in UTC to avoid
// shifting a day for viewers west of Greenwich.
export function formatEventDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" });
}
