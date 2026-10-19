import type { MissionKind } from "./missions";
import { SALON_PACKS, parisDay, type PackDef } from "./packs";

/**
 * Auto shows, on the real calendar: each brings its pack and three
 * challenges for one week, Monday 00:00 to Monday 00:00 (Paris). The week is
 * the one holding the show's anchor day (the nth `dow` of its month).
 * Must match public.salons and public.salon_challenges.
 */
export type SalonDef = {
  id: string;
  name: string;
  /** Where and what, in a few words. */
  place: string;
  blurb: string;
  month: number;
  /** ISO weekday of the anchor day, 1 = Monday. */
  dow: number;
  nth: number;
  /** Held every other year, on even years. */
  evenYears?: boolean;
  pack: PackDef;
};

const pack = (id: string) => SALON_PACKS.find((p) => p.id === id)!;

export const SALONS: SalonDef[] = [
  {
    id: "tokyo-auto-salon",
    name: "Tokyo Auto Salon",
    place: "Makuhari Messe, Chiba",
    blurb: "Le grand rendez-vous de la préparation japonaise ouvre l'année.",
    month: 1,
    dow: 6,
    nth: 2,
    pack: pack("tokyo-auto-salon"),
  },
  {
    id: "retromobile",
    name: "Rétromobile",
    place: "Porte de Versailles, Paris",
    blurb: "Ancêtres, avant-guerre et sixties : le salon des voitures anciennes.",
    month: 2,
    dow: 6,
    nth: 1,
    pack: pack("retromobile"),
  },
  {
    id: "salon-de-geneve",
    name: "Salon de Genève",
    place: "Palexpo, Genève",
    blurb: "Le salon de mars, où GT et voitures de prestige se dévoilent.",
    month: 3,
    dow: 6,
    nth: 1,
    pack: pack("salon-de-geneve"),
  },
  {
    id: "le-mans",
    name: "24 Heures du Mans",
    place: "Circuit de la Sarthe, Le Mans",
    blurb: "La course d'endurance la plus célèbre du monde, et les GT qui la gagnent.",
    month: 6,
    dow: 6,
    nth: 2,
    pack: pack("le-mans"),
  },
  {
    id: "goodwood",
    name: "Goodwood Festival of Speed",
    place: "Goodwood House, Sussex",
    blurb: "Une colline, un château, et les sportives à fond dans la montée.",
    month: 7,
    dow: 6,
    nth: 2,
    pack: pack("goodwood"),
  },
  {
    id: "mondial-de-l-auto",
    name: "Mondial de l'Auto",
    place: "Porte de Versailles, Paris",
    blurb: "Tous les deux ans, la voiture française en vitrine.",
    month: 10,
    dow: 6,
    nth: 3,
    evenYears: true,
    pack: pack("mondial-de-l-auto"),
  },
  {
    id: "sema-show",
    name: "SEMA Show",
    place: "Convention Center, Las Vegas",
    blurb: "La préparation américaine, du muscle car au pick-up.",
    month: 11,
    dow: 2,
    nth: 1,
    pack: pack("sema-show"),
  },
];

export const salonById = (id: string) => SALONS.find((s) => s.id === id);

/** Jetons for each challenge are in the database; finishing all three adds these bonus packs. */
export const SALON_FINALE_PACKS = 2;

const DAY = 86_400_000;

/** Monday of the show's week in a year (a UTC date, only its Y-M-D matters), or null on an off year. */
export function salonWeek(salon: SalonDef, year: number): Date | null {
  if (salon.evenYears && year % 2 !== 0) return null;
  const first = new Date(Date.UTC(year, salon.month - 1, 1));
  const firstDow = first.getUTCDay() || 7;
  const anchor = first.getTime() + (((salon.dow - firstDow + 7) % 7) + (salon.nth - 1) * 7) * DAY;
  const anchorDow = new Date(anchor).getUTCDay() || 7;
  return new Date(anchor - (anchorDow - 1) * DAY);
}

export type SalonEdition = {
  salon: SalonDef;
  /** Monday, first day. */
  starts: Date;
  /** Sunday, last day. */
  ends: Date;
  /** The claim period in the database: "<salon>:<YYYY-MM-DD>". */
  period: string;
};

/** Shows in date order from the one on now (or the next) on, `count` of them. */
export function salonCalendar(at = new Date(), count = 6): SalonEdition[] {
  const today = parisDay(at).getTime();
  const year = new Date(today).getUTCFullYear();
  const editions: SalonEdition[] = [];
  for (let y = year - 1; y <= year + 3; y++) {
    for (const salon of SALONS) {
      const starts = salonWeek(salon, y);
      if (!starts || starts.getTime() + 6 * DAY < today) continue;
      editions.push({
        salon,
        starts,
        ends: new Date(starts.getTime() + 6 * DAY),
        period: `${salon.id}:${starts.toISOString().slice(0, 10)}`,
      });
    }
  }
  return editions.sort((a, b) => a.starts.getTime() - b.starts.getTime()).slice(0, count);
}

export type SalonNow =
  | { live: true; edition: SalonEdition; daysLeft: number }
  | { live: false; edition: SalonEdition; days: number };

/** The show on this week, or the next one and how many days until it opens. */
export function salonOf(at = new Date()): SalonNow {
  const today = parisDay(at).getTime();
  const [edition] = salonCalendar(at, 1);
  if (edition.starts.getTime() <= today) {
    return { live: true, edition, daysLeft: Math.round((edition.ends.getTime() - today) / DAY) };
  }
  return { live: false, edition, days: Math.round((edition.starts.getTime() - today) / DAY) };
}

const monthName = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" });
const day = (d: Date) => (d.getUTCDate() === 1 ? "1er" : String(d.getUTCDate()));

/** "du 2 au 8 novembre", "du 1er au 7 mars", "du 27 octobre au 2 novembre". */
export function salonDates({ starts, ends }: Pick<SalonEdition, "starts" | "ends">) {
  const sameMonth = starts.getUTCMonth() === ends.getUTCMonth();
  return `du ${day(starts)}${sameMonth ? "" : ` ${monthName.format(starts)}`} au ${day(ends)} ${monthName.format(ends)}`;
}

/** "Dans 3 jours", "Demain", "Dans 2 semaines". */
export function salonCountdown(days: number) {
  if (days <= 1) return "Demain";
  if (days < 14) return `Dans ${days} jours`;
  if (days < 60) return `Dans ${Math.round(days / 7)} semaines`;
  return `Dans ${Math.round(days / 30)} mois`;
}

export const SALON_RULES =
  "Chaque salon dure une semaine, du lundi au dimanche (heure de Paris) : son pack n'est en vente que pendant cette semaine, et seuls les packs ouverts et les actions faites pendant le salon comptent pour ses défis.";

/** A player's challenges for the show on now (public.my_salon). */
export type SalonChallenge = {
  ord: number;
  kind: MissionKind;
  param: string | null;
  goal: number;
  reward: number;
  progress: number;
  claimed: boolean;
};

export type SalonBoard = {
  salonId: string;
  period: string;
  challenges: SalonChallenge[];
  finaleClaimed: boolean;
};
