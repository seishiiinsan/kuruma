import "server-only";
import data from "@/data/series.json";

export type Series = {
  id: string;
  name: string;
  kind: "brand" | "theme";
  /** Card slugs, oldest car first. */
  cards: string[];
  packs: number;
  points: number;
};

export const SERIES = data as Series[];

const byId = new Map(SERIES.map((s) => [s.id, s]));
const byCard = new Map<string, Series[]>();
for (const s of SERIES) for (const slug of s.cards) byCard.set(slug, [...(byCard.get(slug) ?? []), s]);

export const seriesById = (id: string) => byId.get(id);
export const seriesOfCard = (slug: string) => byCard.get(slug) ?? [];

export type SeriesProgress = Series & {
  owned: number;
  complete: boolean;
  claimedAt: string | null;
};

export function progressOf(
  series: Series,
  owned: Set<string>,
  claims: Map<string, string>,
): SeriesProgress {
  const count = series.cards.filter((slug) => owned.has(slug)).length;
  return {
    ...series,
    owned: count,
    complete: count === series.cards.length,
    claimedAt: claims.get(series.id) ?? null,
  };
}
