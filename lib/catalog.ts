import "server-only";
import catalogue from "@/data/cards.json";
import type { CardData } from "./cards";

// A local Supabase has no car photos: dev reads them from the production bucket.
const STORAGE = `${process.env.NEXT_PUBLIC_PHOTOS_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;

/** Hosted photos are stored as a bucket path; Commons fallbacks as full URLs. */
export const CARDS = (catalogue as CardData[]).map((card) =>
  card.image.startsWith("http") ? card : { ...card, image: STORAGE + card.image },
);

const bySlug = new Map(CARDS.map((card) => [card.slug, card]));

export const cardBySlug = (slug: string) => bySlug.get(slug);

export const CATALOGUE_SIZE = CARDS.length;

export const CULTURES = [...new Set(CARDS.map((card) => card.culture))].sort(
  (a, b) => CARDS.filter((c) => c.culture === b).length - CARDS.filter((c) => c.culture === a).length,
);

/** Cars picked for the marketing pages, by slug. */
export function showcase(slugs: string[]): CardData[] {
  return slugs.map((slug) => bySlug.get(slug)).filter((card): card is CardData => Boolean(card));
}
