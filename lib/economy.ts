import type { CardTier } from "./cards";

/**
 * The game economy. Jetons are earned in game only (achievements, the daily
 * bonus, selling duplicates) and spent in game only (extra packs, premium
 * packs, cards in the shop): there is no real money anywhere.
 *
 * Balance targets, for a standard 5-card pack at 200 jetons:
 * - Selling every card of a pack gives back ~48 jetons (24 %), so buying
 *   packs to resell them always loses.
 * - The daily bonus (60 → 120) is a third to a half of a pack.
 * - A chosen card costs far more than its share of a random pack: you pay
 *   for the choice.
 *
 * Every number here must match supabase/migrations/*_economy.sql.
 */

export const CURRENCY = { one: "jeton", many: "jetons" };

export const formatCoins = (n: number) =>
  `${new Intl.NumberFormat("fr-FR").format(n)} ${n > 1 ? CURRENCY.many : CURRENCY.one}`;

/** New card from the daily or weekly window (public.shop_price). */
export const SHOP_PRICE: Record<CardTier, number> = {
  common: 80,
  rare: 200,
  epic: 700,
  legendary: 2500,
};

/** Copy resold by a player (public.used_price). */
export const USED_PRICE: Record<CardTier, number> = {
  common: 50,
  rare: 120,
  epic: 420,
  legendary: 1500,
};

/** What the shop pays for a duplicate (public.sell_price). */
export const SELL_PRICE: Record<CardTier, number> = {
  common: 2,
  rare: 6,
  epic: 25,
  legendary: 100,
};

/** Daily bonus for the nth day in a row (public.daily_reward). */
export const dailyReward = (streak: number) => 60 + 10 * (Math.min(Math.max(streak, 1), 7) - 1);
export const DAILY_MAX_STREAK = 7;

/* ---------- Achievements ---------- */

export type Metric =
  | "cards"
  | "epics"
  | "legendaries"
  | "packs"
  | "trades"
  | "series"
  | "cultures"
  | "serials"
  | "days"
  | "score"
  | "garage"
  | "sold"
  | "bought"
  /** Driving permit level (lib/permit.ts); unlocks cosmetics, no achievement. */
  | "level";

export type Metrics = Record<Metric, number>;

export type AchievementFamily = {
  metric: Metric;
  name: string;
  /** "{n}" is replaced by the step's goal. */
  goal: string;
  steps: [goal: number, reward: number][];
};

/** One row of public.achievements per step, id `${metric}-${goal}`. */
export const ACHIEVEMENTS: AchievementFamily[] = [
  {
    metric: "cards",
    name: "Collectionneur",
    goal: "Posséder {n} voitures différentes",
    steps: [[10, 50], [25, 80], [50, 120], [100, 200], [250, 350], [500, 600], [1000, 1200], [1500, 2000], [2000, 3000]],
  },
  {
    metric: "epics",
    name: "Pièces rares",
    goal: "Posséder {n} voitures épiques différentes",
    steps: [[1, 50], [5, 100], [15, 250], [40, 500], [100, 1000], [200, 2000]],
  },
  {
    metric: "legendaries",
    name: "Légendes",
    goal: "Posséder {n} voitures légendaires différentes",
    steps: [[1, 150], [3, 300], [10, 600], [25, 1200], [50, 2500], [100, 5000]],
  },
  {
    metric: "packs",
    name: "Déchireur de packs",
    goal: "Ouvrir {n} packs",
    steps: [[1, 30], [10, 80], [50, 150], [100, 250], [250, 500], [500, 800], [1000, 1500]],
  },
  {
    metric: "trades",
    name: "Négociant",
    goal: "Conclure {n} échanges",
    steps: [[1, 100], [5, 150], [15, 300], [40, 600], [100, 1200]],
  },
  {
    metric: "series",
    name: "Albums complets",
    goal: "Réclamer {n} séries",
    steps: [[1, 150], [3, 250], [10, 500], [25, 1000], [50, 2000], [100, 4000]],
  },
  {
    metric: "cultures",
    name: "Globe-trotter",
    goal: "Posséder des voitures de {n} cultures",
    steps: [[3, 40], [5, 80], [8, 250]],
  },
  {
    metric: "serials",
    name: "Première main",
    goal: "Posséder {n} exemplaires Nº 1",
    steps: [[1, 30], [10, 80], [50, 200], [150, 500]],
  },
  {
    metric: "score",
    name: "Cote de collection",
    goal: "Atteindre {n} points",
    steps: [[1000, 100], [5000, 250], [20000, 600], [50000, 1200], [100000, 2500]],
  },
  {
    metric: "days",
    name: "Habitué",
    goal: "Toucher la prime du jour {n} fois",
    steps: [[3, 60], [7, 120], [30, 400], [100, 1200], [365, 4000]],
  },
  {
    metric: "garage",
    name: "Garage complet",
    goal: "Exposer {n} voitures dans ton garage",
    steps: [[6, 80]],
  },
  {
    metric: "sold",
    name: "Ferrailleur",
    goal: "Revendre {n} doubles à la boutique",
    steps: [[10, 50], [100, 150], [500, 400]],
  },
  {
    metric: "bought",
    name: "Client fidèle",
    goal: "Acheter {n} cartes à la boutique",
    steps: [[1, 50], [10, 150], [50, 400]],
  },
];

export const achievementId = (metric: Metric, goal: number) => `${metric}-${goal}`;

export const goalText = (family: AchievementFamily, goal: number) =>
  family.goal.replace("{n}", new Intl.NumberFormat("fr-FR").format(goal));

export type FamilyProgress = {
  family: AchievementFamily;
  value: number;
  /** Steps reached and not yet claimed. */
  claimable: { id: string; goal: number; reward: number }[];
  /** Next step still to reach, null once every step is reached. */
  next: { goal: number; reward: number; from: number } | null;
  /** Steps claimed, out of family.steps.length. */
  claimed: number;
};

export function familyProgress(family: AchievementFamily, metrics: Metrics, claimed: Set<string>): FamilyProgress {
  const value = metrics[family.metric] ?? 0;
  const claimable = family.steps
    .filter(([goal]) => value >= goal && !claimed.has(achievementId(family.metric, goal)))
    .map(([goal, reward]) => ({ id: achievementId(family.metric, goal), goal, reward }));
  const index = family.steps.findIndex(([goal]) => value < goal);
  const next =
    index === -1
      ? null
      : { goal: family.steps[index][0], reward: family.steps[index][1], from: index > 0 ? family.steps[index - 1][0] : 0 };
  return {
    family,
    value,
    claimable,
    next,
    claimed: family.steps.filter(([goal]) => claimed.has(achievementId(family.metric, goal))).length,
  };
}

export const TOTAL_ACHIEVEMENT_REWARDS = ACHIEVEMENTS.reduce(
  (sum, f) => sum + f.steps.reduce((s, [, reward]) => s + reward, 0),
  0,
);
