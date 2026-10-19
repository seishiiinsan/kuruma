import type { CardTier } from "./cards";

/** A run of identical slots: `odds` are the % chances of common, rare, epic, legendary. */
export type SlotGroup = { n: number; odds: [number, number, number, number] };

export type PackDef = {
  id: string;
  name: string;
  tagline: string;
  image: string;
  accent: string;
  /** Opens with free (timed or bonus) packs; otherwise jetons only. */
  free: boolean;
  /** In jetons: buys one more when free packs run out, or the only way in for premium packs. */
  price: number;
  slots: SlotGroup[];
  /** Weekend packs only: their turn in the rotation (public.packs.rotation). */
  rotation?: number;
  /** Auto show packs only: the show that brings it (public.salons, lib/salons.ts). */
  salon?: string;
};

const STANDARD: SlotGroup[] = [
  { n: 4, odds: [60, 28, 9, 3] },
  { n: 1, odds: [0, 75, 19, 6] },
];

/** Must match public.packs in the database (themes and weights live there). */
export const PACKS: PackDef[] = [
  {
    id: "edition-01",
    name: "Édition 01",
    tagline: "Toutes les cultures, à parts égales.",
    image: "/booster/edition-01.webp",
    accent: "#ff6b1a",
    free: true,
    price: 200,
    slots: STANDARD,
  },
  {
    id: "nuit-jdm",
    name: "Nuit JDM",
    tagline: "4 cartes sur 5 en moyenne : JDM et kei cars.",
    image: "/booster/nuit-jdm.webp",
    accent: "#7a3cff",
    free: true,
    price: 200,
    slots: STANDARD,
  },
  {
    id: "grand-tourisme",
    name: "Grand Tourisme",
    tagline: "8 rares ou mieux sur 10 : sportives et GT.",
    image: "/booster/grand-tourisme.webp",
    accent: "#1f6fff",
    free: true,
    price: 200,
    slots: STANDARD,
  },
  {
    id: "garage-classique",
    name: "Garage Classique",
    tagline: "4 cartes sur 5 en moyenne : classiques et youngtimers.",
    image: "/booster/garage-classique.webp",
    accent: "#d94a7a",
    free: true,
    price: 200,
    slots: STANDARD,
  },
  {
    id: "reve-americain",
    name: "Rêve américain",
    tagline: "4 cartes sur 5 en moyenne : américaines et muscle cars.",
    image: "/booster/reve-americain.webp",
    accent: "#e3262f",
    free: true,
    price: 200,
    slots: STANDARD,
  },
  {
    id: "hors-piste",
    name: "Hors-piste",
    tagline: "4 cartes sur 5 en moyenne : 4×4 et tout-terrain.",
    image: "/booster/hors-piste.webp",
    accent: "#4f9a12",
    free: true,
    price: 200,
    slots: STANDARD,
  },
  {
    id: "tour-du-monde",
    name: "Tour du monde",
    tagline: "6 cartes, 8 sur 10 venues du bloc de l'Est, de Corée, des kei cars et du reste du monde.",
    image: "/booster/tour-du-monde.webp",
    accent: "#0fa89c",
    free: false,
    price: 300,
    slots: [
      { n: 5, odds: [60, 28, 9, 3] },
      { n: 1, odds: [0, 75, 19, 6] },
    ],
  },
  {
    id: "prestige",
    name: "Prestige",
    tagline: "Luxe et GT, deux fois moins de communes, et une épique ou mieux garantie.",
    image: "/booster/prestige.webp",
    accent: "#e2c27a",
    free: false,
    price: 450,
    slots: [
      { n: 4, odds: [40, 40, 15, 5] },
      { n: 1, odds: [0, 0, 80, 20] },
    ],
  },
  {
    id: "legende",
    name: "Légende",
    tagline: "3 cartes : deux épiques ou mieux, et une légendaire garantie.",
    image: "/booster/legende.webp",
    accent: "#e9a20c",
    free: false,
    price: 1200,
    slots: [
      { n: 2, odds: [0, 0, 75, 25] },
      { n: 1, odds: [0, 0, 0, 100] },
    ],
  },
];

/**
 * One of these is on sale each weekend, Friday 00:00 to Monday 00:00 (Paris),
 * in turn by ISO week. Must match public.packs (rotation) and public.weekend_pack.
 */
export const WEEKEND_PACKS: PackDef[] = [
  {
    id: "annees-80",
    name: "Années 80",
    tagline: "4 cartes sur 5 en moyenne : des voitures lancées dans les années 80.",
    image: "/booster/annees-80.webp",
    accent: "#ff3d9a",
    free: true,
    price: 200,
    slots: STANDARD,
    rotation: 0,
  },
  {
    id: "rideau-de-fer",
    name: "Rideau de fer",
    tagline: "4 cartes sur 5 en moyenne : Lada, Trabant, Wartburg et le reste du bloc de l'Est.",
    image: "/booster/rideau-de-fer.webp",
    accent: "#8d99a8",
    free: true,
    price: 200,
    slots: STANDARD,
    rotation: 1,
  },
  {
    id: "annees-90",
    name: "Années 90",
    tagline: "4 cartes sur 5 en moyenne : des voitures lancées dans les années 90.",
    image: "/booster/annees-90.webp",
    accent: "#16c6e8",
    free: true,
    price: 200,
    slots: STANDARD,
    rotation: 2,
  },
  {
    id: "salon-de-luxe",
    name: "Salon de luxe",
    tagline: "4 cartes sur 5 en moyenne : berlines de prestige et voitures de luxe.",
    image: "/booster/salon-de-luxe.webp",
    accent: "#a3244a",
    free: true,
    price: 200,
    slots: STANDARD,
    rotation: 3,
  },
  {
    id: "annees-2000",
    name: "Années 2000",
    tagline: "4 cartes sur 5 en moyenne : des voitures lancées dans les années 2000.",
    image: "/booster/annees-2000.webp",
    accent: "#a8c418",
    free: true,
    price: 200,
    slots: STANDARD,
    rotation: 4,
  },
];

/** Paris calendar date of an instant, as a UTC date (only its Y-M-D and weekday matter). */
export function parisDay(at: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return new Date(Date.UTC(get("year"), get("month") - 1, get("day")));
}

/** ISO weekday (1 = Monday) and ISO week number, like Postgres' isodow and week. */
function isoWeek(day: Date) {
  const dow = day.getUTCDay() || 7;
  const thursday = new Date(day);
  thursday.setUTCDate(day.getUTCDate() + 4 - dow);
  const jan1 = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  return { dow, week: Math.ceil(((thursday.getTime() - jan1.getTime()) / 86_400_000 + 1) / 7) };
}

export type Weekend =
  | { live: true; pack: PackDef }
  | { live: false; pack: PackDef; days: number };

/** The weekend pack on sale now, or the next one and how many days until Friday. */
export function weekendOf(at = new Date()): Weekend {
  const day = parisDay(at);
  const { dow, week } = isoWeek(day);
  const live = dow >= 5;
  if (live) return { live, pack: WEEKEND_PACKS[week % WEEKEND_PACKS.length] };
  // Monday to Thursday: this week's Friday belongs to the same ISO week.
  return { live, pack: WEEKEND_PACKS[week % WEEKEND_PACKS.length], days: 5 - dow };
}

/**
 * One per auto show, on sale only during its week (lib/salons.ts).
 * Must match public.packs and public.salons.
 */
export const SALON_PACKS: PackDef[] = [
  {
    id: "tokyo-auto-salon",
    name: "Tokyo Auto Salon",
    tagline: "4 cartes sur 5 en moyenne : JDM et kei cars, comme dans les halls de Makuhari.",
    image: "/booster/tokyo-auto-salon.webp",
    accent: "#ff2e63",
    free: true,
    price: 200,
    slots: STANDARD,
    salon: "tokyo-auto-salon",
  },
  {
    id: "retromobile",
    name: "Rétromobile",
    tagline: "4 cartes sur 5 en moyenne : des voitures lancées avant 1970.",
    image: "/booster/retromobile.webp",
    accent: "#c8873a",
    free: true,
    price: 200,
    slots: STANDARD,
    salon: "retromobile",
  },
  {
    id: "salon-de-geneve",
    name: "Salon de Genève",
    tagline: "4 cartes sur 5 en moyenne : GT et voitures de prestige.",
    image: "/booster/salon-de-geneve.webp",
    accent: "#4a6b8a",
    free: true,
    price: 200,
    slots: STANDARD,
    salon: "salon-de-geneve",
  },
  {
    id: "le-mans",
    name: "24 Heures du Mans",
    tagline: "Grand tourisme : 8 cartes rares ou mieux sur 10 sont des GT.",
    image: "/booster/le-mans.webp",
    accent: "#ffd400",
    free: true,
    price: 200,
    slots: STANDARD,
    salon: "le-mans",
  },
  {
    id: "goodwood",
    name: "Goodwood",
    tagline: "4 cartes sur 5 en moyenne : des sportives, à l'assaut de la colline.",
    image: "/booster/goodwood.webp",
    accent: "#1f8a4c",
    free: true,
    price: 200,
    slots: STANDARD,
    salon: "goodwood",
  },
  {
    id: "mondial-de-l-auto",
    name: "Mondial de l'Auto",
    tagline: "4 cartes sur 5 en moyenne : des voitures françaises.",
    image: "/booster/mondial-de-l-auto.webp",
    accent: "#0a5bd8",
    free: true,
    price: 200,
    slots: STANDARD,
    salon: "mondial-de-l-auto",
  },
  {
    id: "sema-show",
    name: "SEMA Show",
    tagline: "4 cartes sur 5 en moyenne : américaines et muscle cars, préparées à Las Vegas.",
    image: "/booster/sema-show.webp",
    accent: "#ff8a00",
    free: true,
    price: 200,
    slots: STANDARD,
    salon: "sema-show",
  },
];

const ALL_PACKS = [...PACKS, ...WEEKEND_PACKS, ...SALON_PACKS];

export const packById = (id: string) => ALL_PACKS.find((pack) => pack.id === id);

export const packSize = (pack: PackDef) => pack.slots.reduce((sum, group) => sum + group.n, 0);

const TIER_KEYS: CardTier[] = ["common", "rare", "epic", "legendary"];

/** The pack's odds as readable blocks ("Cartes 1 à 4", "Carte 5"). */
export function oddsOf(pack: PackDef): { label: string; rows: [CardTier, number][] }[] {
  let first = 1;
  return pack.slots.map((group) => {
    const last = first + group.n - 1;
    const label = group.n === 1 ? `Carte ${first}` : `Cartes ${first} à ${last}`;
    first = last + 1;
    return {
      label,
      rows: group.odds.flatMap((pct, i) => (pct > 0 ? [[TIER_KEYS[i], pct] as [CardTier, number]] : [])),
    };
  });
}

export const MAX_PACKS = 10;
export const REFILL_MINUTES = 10;

/** Timed packs (capped at 10), bonus packs earned from series (never expire), and jetons. */
export type Wallet = {
  available: number;
  msToNext: number | null;
  bonus: number;
  coins: number;
  /** The daily bonus can be claimed now. */
  dailyReady: boolean;
  /** Days in a row the daily bonus was claimed, 0 once the streak is broken. */
  streak: number;
  /** Achievement steps reached and not yet claimed. */
  claimable: number;
  /** Missions done and not yet claimed. */
  missions: number;
  /** Server time of the reading, so a stale (cached) reading never wins over a newer one. */
  readAt: number;
};
