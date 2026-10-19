import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Public pages (cards, players, albums, leaderboard) are crawlable; the player's own screens aren't. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/auth/",
        "/connexion",
        "/parametres",
        "/moi",
        "/personnaliser",
        "/collection",
        "/boosters",
        "/boutique",
        "/echanges",
        "/succes",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
