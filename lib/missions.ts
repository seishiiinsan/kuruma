import type { CardTier } from "./cards";
import { packById } from "./packs";

/**
 * Missions: three a day and three a week, the same for every player, drawn
 * by public.mission_board from public.missions. This file only words them:
 * every kind and param used in the database needs a label here.
 */

export type MissionKind =
  | "open"
  | "open_pack"
  | "pull_tier"
  | "pull_trait"
  | "offer"
  | "trade"
  | "sell"
  | "buy"
  | "daily";

export type Mission = {
  id: string;
  period: string;
  cadence: "day" | "week";
  kind: MissionKind;
  param: string | null;
  goal: number;
  reward: number;
  progress: number;
  claimed: boolean;
};

const TIER_WORDS: Record<CardTier, [one: string, many: string]> = {
  common: ["carte", "cartes"],
  rare: ["carte rare ou mieux", "cartes rares ou mieux"],
  epic: ["carte épique ou mieux", "cartes épiques ou mieux"],
  legendary: ["carte légendaire", "cartes légendaires"],
};

/** "Tire 3 voitures {word}". */
const TRAIT_WORDS: Record<string, string> = {
  JDM: "JDM",
  US: "américaines",
  Euro: "européennes",
  classique: "classiques",
  youngtimer: "youngtimers",
  "tout-terrain": "tout-terrain",
  sportive: "sportives",
  luxe: "de luxe",
  gt: "GT",
  Kei: "kei cars",
  "pays-france": "françaises",
};

const plural = (n: number, one: string, many: string) => (n > 1 ? many : one);

export function missionText({ kind, param, goal: n }: Pick<Mission, "kind" | "param" | "goal">): string {
  switch (kind) {
    case "open":
      return `Ouvre ${n} ${plural(n, "pack", "packs")}`;
    case "open_pack":
      return `Ouvre ${n} ${plural(n, "pack", "packs")} ${packById(param ?? "")?.name ?? ""}`.trim();
    case "pull_tier": {
      const [one, many] = TIER_WORDS[(param as CardTier) ?? "common"] ?? TIER_WORDS.common;
      return `Tire ${n} ${plural(n, one, many)}`;
    }
    case "pull_trait":
      return `Tire ${n} ${plural(n, "voiture", "voitures")} ${TRAIT_WORDS[param ?? ""] ?? param}`;
    case "offer":
      return `Propose ${n} ${plural(n, "échange", "échanges")}`;
    case "trade":
      return `Conclus ${n} ${plural(n, "échange", "échanges")}`;
    case "sell":
      return `Revends ${n} ${plural(n, "double", "doubles")} à la boutique`;
    case "buy":
      return `Achète ${n} ${plural(n, "carte", "cartes")} en boutique`;
    case "daily":
      return n === 1 ? "Touche la prime du jour" : `Touche la prime du jour ${n} fois`;
  }
}

/** Where to go to move a mission forward. */
export function missionHref({ kind, param }: Pick<Mission, "kind" | "param">): string {
  switch (kind) {
    case "open":
    case "pull_tier":
    case "pull_trait":
      return "/boosters";
    case "open_pack":
      return `/boosters?pack=${param}`;
    case "offer":
    case "trade":
      return "/echanges";
    case "sell":
    case "buy":
      return "/boutique";
    case "daily":
      return "/succes";
  }
}

/** Missions packs and pulls count only from packs opened during the period. */
export const MISSION_RULES =
  "Les missions du jour changent à minuit, celles de la semaine le lundi (heure de Paris). Seuls les packs ouverts et les actions faites pendant la période comptent.";
