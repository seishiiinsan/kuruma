import "server-only";
import { CARDS, cardBySlug } from "./catalog";
import { toFace, type CardFace } from "./cards";

const pick = (slugs: string[]): CardFace[] =>
  slugs.flatMap((slug) => {
    const card = cardBySlug(slug);
    return card ? [toFace(card)] : [];
  });

/** Hero fan, left to right; the centre card is the rarest. */
export const HERO = () =>
  pick(["citroen-ds", "toyota-supra", "mclaren-f1", "lancia-stratos", "dodge-charger"]);

export const COLLECT = () => pick(["honda-n360", "honda-nsx", "lamborghini-miura"]);
export const TRADE = () => pick(["mazda-mx-5", "nissan-skyline-gt-r"]);
export const GARAGE = () => pick(["lancia-delta-s4", "renault-5-turbo", "porsche-911"]);

/** A hand across the scenes, left to right: kei, Est, roadster, muscle, the supercar, JDM, euro, rally, French classic. */
export const HAND = () =>
  pick([
    "honda-n360",
    "trabant-601",
    "mazda-mx-5",
    "dodge-charger",
    "lamborghini-miura",
    "nissan-skyline-gt-r",
    "porsche-911",
    "lancia-delta-s4",
    "citroen-ds",
  ]);
export const LOGIN = () => pick(["lamborghini-countach", "ferrari-f40", "mclaren-f1"]);

/** The landing page's demo booster draws from the most famous cars of each tier. */
export function demoPool(): CardFace[] {
  const famous = [...CARDS].sort((a, b) => b.fame - a.fame);
  const take = (tier: CardFace["tier"], n: number) =>
    famous.filter((card) => card.tier === tier).slice(0, n).map(toFace);
  return [...take("common", 20), ...take("rare", 14), ...take("epic", 8), ...take("legendary", 4)];
}
