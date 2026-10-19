"use client";

import { TIER_ORDER, TIERS, type CardFace } from "@/lib/cards";
import { BoosterButton, BoosterStage, useBooster } from "./booster";
import { RarityDiamonds } from "./rarity-diamonds";

export function BoosterSection({ pool, catalogueSize }: { pool: CardFace[]; catalogueSize: number }) {
  const booster = useBooster(pool);

  return (
    <section className="relative overflow-x-clip border-y border-white/10 bg-bg-deep/60 py-16 sm:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-5 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
        <div>
          <h2 className="title-drop text-balance font-display text-3xl sm:text-[2.6rem] sm:leading-[1.1]">
            Ouvre un booster, ici, maintenant
          </h2>
          <p className="mt-4 max-w-md text-pretty text-muted">
            {catalogueSize.toLocaleString("fr-FR")} vraies voitures, de la citadine du quotidien au
            prototype construit à un seul exemplaire. Plus une voiture est rare
            dans la réalité, plus elle l&apos;est dans le jeu : la McLaren F1
            n&apos;existe qu&apos;en 106 cartes, comme en vrai.
          </p>

          <ul className="mt-6 flex max-w-md flex-wrap gap-2">
            {TIER_ORDER.map((tier) => (
              <li
                key={tier}
                className="inline-flex items-center gap-2 rounded-full bg-surface-lo px-3 py-1.5 text-sm font-extrabold"
                style={{ color: TIERS[tier].color }}
              >
                <RarityDiamonds tier={tier} size={10} />
                {TIERS[tier].label}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <BoosterButton booster={booster} />
            <span className="text-xs font-bold text-muted">
              Démo : ces cartes ne vont dans aucune collection.
            </span>
          </div>
        </div>

        <BoosterStage booster={booster} />
      </div>
    </section>
  );
}
