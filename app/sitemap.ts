import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";
import { CARDS } from "@/lib/catalog";
import { SERIES } from "@/lib/series";
import { SITE_URL } from "@/lib/site";
import { supabasePublic } from "@/lib/supabase/public";

async function playerHandles() {
  "use cache";
  cacheLife("hours");
  const { data } = await supabasePublic().from("profiles").select("handle").order("created_at");
  return (data ?? []).map((p) => p.handle);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => `${SITE_URL}${path}`;
  return [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    { url: url("/classement"), changeFrequency: "daily", priority: 0.8 },
    { url: url("/album"), changeFrequency: "weekly", priority: 0.7 },
    ...SERIES.map((s) => ({ url: url(`/album/${s.id}`), changeFrequency: "weekly" as const, priority: 0.5 })),
    ...CARDS.map((c) => ({ url: url(`/cartes/${c.slug}`), changeFrequency: "daily" as const, priority: 0.6 })),
    ...(await playerHandles()).map((handle) => ({
      url: url(`/joueur/${handle}`),
      changeFrequency: "daily" as const,
      priority: 0.4,
    })),
    { url: url("/conditions"), changeFrequency: "yearly", priority: 0.1 },
    { url: url("/confidentialite"), changeFrequency: "yearly", priority: 0.1 },
    { url: url("/mentions-legales"), changeFrequency: "yearly", priority: 0.1 },
  ];
}
