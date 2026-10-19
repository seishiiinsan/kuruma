export type CardTier = "common" | "rare" | "epic" | "legendary";

/** One car of the catalogue, built from open data by scripts/cars. */
export type CardData = {
  slug: string;
  name: string;
  brand: string | null;
  culture: string;
  tags: string[];
  tier: CardTier;
  year: number | null;
  yearEnd: number | null;
  country: string | null;
  body: string | null;
  powerHp: number | null;
  engine: string | null;
  displacementCc: number | null;
  massKg: number | null;
  topSpeedKmh: number | null;
  /** 0 to 100 km/h, in seconds. */
  zeroTo100: number | null;
  /** Units built in the real world: the cap on copies in the game. */
  supply: number | null;
  description: string;
  source: { lang: "fr" | "en"; url: string };
  image: string;
  photo: {
    author: string | null;
    license: string | null;
    licenseUrl: string | null;
    source: string;
  };
  wikidata: string;
  fame: number;
};

/** The fields a card face needs; keeps client payloads small. */
export type CardFace = Pick<
  CardData,
  "slug" | "name" | "brand" | "culture" | "tier" | "image" | "supply" | "year" | "powerHp"
>;

export const toFace = ({ slug, name, brand, culture, tier, image, supply, year, powerHp }: CardFace): CardFace => ({
  slug,
  name,
  brand,
  culture,
  tier,
  image,
  supply,
  year,
  powerHp,
});

export const TIERS: Record<
  CardTier,
  { label: string; diamonds: number; color: string; points: number }
> = {
  common: { label: "Commune", diamonds: 1, color: "var(--color-tier-common)", points: 10 },
  rare: { label: "Rare", diamonds: 2, color: "var(--color-tier-rare)", points: 30 },
  epic: { label: "Épique", diamonds: 3, color: "var(--color-tier-epic)", points: 100 },
  legendary: {
    label: "Légendaire",
    diamonds: 4,
    color: "var(--color-tier-legendary)",
    points: 400,
  },
};

export const TIER_ORDER: CardTier[] = ["common", "rare", "epic", "legendary"];

export const byRarity = (a: { tier: CardTier }, b: { tier: CardTier }) =>
  TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier);

const int = new Intl.NumberFormat("fr-FR");
const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });

export const formatInt = (n: number) => int.format(n);

/** Units built, short: "106", "1 337", "21,5 M". */
export const formatSupply = (n: number) => (n >= 10000 ? compact.format(n) : int.format(n));

/** "Nº 12 / 106", "Nº 12 / 2,4 M", or "Nº 12" when the car has no known run. */
export function formatSerial(serial: number, supply: number | null) {
  if (supply == null) return `Nº ${int.format(serial)}`;
  return `Nº ${int.format(serial)}/${formatSupply(supply)}`;
}

/** A copy's print: rolled when it is minted (public.roll_finish). */
export type Finish = "standard" | "holo" | "vintage";

export const FINISHES: Record<Finish, { label: string; odds: number; blurb: string }> = {
  standard: { label: "Standard", odds: 0.94, blurb: "" },
  holo: { label: "Holo", odds: 0.04, blurb: "Tirage holographique : une copie sur 25." },
  vintage: { label: "Photo d'époque", odds: 0.02, blurb: "Tirage façon photo d'époque : une copie sur 50." },
};

export const asFinish = (value: string | null | undefined): Finish =>
  value === "holo" || value === "vintage" ? value : "standard";

/** Numbers worth a badge: the first, the low ones, the very last of a run. */
export function serialBadge(serial: number, supply: number | null): string | null {
  if (serial === 1) return "Premier exemplaire";
  if (supply !== null && supply > 1 && serial === supply) return "Dernier exemplaire";
  if (serial <= 10) return "Numéro bas";
  return null;
}
