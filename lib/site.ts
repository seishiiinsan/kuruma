/**
 * The public address of the site, for absolute links in metadata, the sitemap
 * and share previews. NEXT_PUBLIC_SITE_URL overrides it (preview deployments).
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NODE_ENV === "production" ? "https://kuruma.games" : "http://localhost:3000")
).replace(/\/$/, "");

export const SITE_NAME = "Kuruma";
