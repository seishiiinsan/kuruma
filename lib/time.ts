const rtf = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });
const date = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });
const monthYear = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

/** "il y a 5 minutes", "hier", then "12 oct." past a week. */
export function timeAgo(iso: string, now = Date.now()) {
  const seconds = Math.round((Date.parse(iso) - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return "à l'instant";
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 7 * 86400) return rtf.format(Math.round(seconds / 86400), "day");
  return date.format(new Date(iso));
}

export const formatMonthYear = (iso: string) => monthYear.format(new Date(iso));
