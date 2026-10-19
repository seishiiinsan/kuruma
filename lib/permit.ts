/**
 * Driving permit: player levels earned by playing. Experience comes from
 * what the player already did, the level reached never goes down, and some
 * levels unlock a garage place, a shop discount or a cosmetic.
 *
 * Every number here must match supabase/migrations/*_driving_permit.sql.
 */

export const MAX_LEVEL = 30;

/** Experience per action (public.permit_xp). */
export const XP_SOURCES: { label: string; xp: number; hint?: string }[] = [
  { label: "Série complétée", xp: 150 },
  { label: "Défi de salon", xp: 60 },
  { label: "Palier de succès", xp: 40 },
  { label: "Prime du jour", xp: 25 },
  { label: "Échange conclu", xp: 20, hint: "un par joueur et par jour" },
  { label: "Mission réclamée", xp: 15 },
  { label: "Pack ouvert", xp: 10 },
];

/** Experience needed to reach a level (public.permit_threshold). */
export const threshold = (level: number) => 100 * (level - 1) + 25 * (level - 1) * (level - 2);

/** Places in the garage (public.permit_garage_slots). */
export const garageSlots = (level: number) =>
  6 + Number(level >= 5) + Number(level >= 10) + Number(level >= 20) + Number(level >= 30);

/** Percent off cards bought at the shop (public.permit_discount). */
export const shopDiscount = (level: number) => (level >= 30 ? 15 : level >= 20 ? 10 : level >= 10 ? 5 : 0);

/** A shop price after the discount (public.discounted). */
export const discounted = (price: number, level: number) => Math.ceil((price * (100 - shopDiscount(level))) / 100);

export type Grade = {
  level: number;
  name: string;
  /** What reaching it gives, in short. */
  rewards: string[];
  /** Accent of its card: a CSS colour. */
  tint: string;
};

/** Permits, from the first level up (cosmetic ids match lib/cosmetics.ts). */
export const GRADES: Grade[] = [
  { level: 1, name: "Conduite accompagnée", rewards: ["6 places au garage"], tint: "#a9b1cf" },
  { level: 5, name: "Permis B", rewards: ["7e place au garage", "Titre « Permis B »"], tint: "#2fd27a" },
  {
    level: 10,
    name: "Licence circuit",
    rewards: ["8e place au garage", "−5 % en boutique", "Cadre « Licence circuit »"],
    tint: "#4fb0ff",
  },
  { level: 15, name: "Licence rallye", rewards: ["Badge « Licence rallye »", "Bannière « Spéciale »"], tint: "#ff9a3c" },
  {
    level: 20,
    name: "Pilote d'essai",
    rewards: ["9e place au garage", "−10 % en boutique", "Titre « Pilote d'essai »"],
    tint: "#c77dff",
  },
  { level: 25, name: "Pilote officiel", rewards: ["Cadre « Pilote officiel »"], tint: "#ff4d6d" },
  {
    level: 30,
    name: "Légende du paddock",
    rewards: ["10e place au garage", "−15 % en boutique", "Titre et bannière « Légende du paddock »"],
    tint: "#ffcc33",
  },
];

/** Rewards inside a sentence: "7e place au garage, titre « Permis B »". */
export const rewardsText = (grade: Grade) => grade.rewards.map((r) => r.charAt(0).toLowerCase() + r.slice(1)).join(", ");

export const gradeOf = (level: number) => GRADES.findLast((g) => g.level <= level) ?? GRADES[0];
export const nextGrade = (level: number) => GRADES.find((g) => g.level > level) ?? null;

export type Permit = {
  level: number;
  xp: number;
  /** Experience at the start of this level and needed for the next; null at the top. */
  from: number;
  to: number | null;
};

export const toPermit = (level: number, xp: number): Permit => ({
  level,
  xp,
  from: threshold(level),
  to: level >= MAX_LEVEL ? null : threshold(level + 1),
});
