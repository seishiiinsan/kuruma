import { Clock, Gift, Layers } from "lucide-react";
import type { CardFace } from "@/lib/cards";
import { DiscordButton } from "./discord-button";
import { HeroCards } from "./hero-cards";

export function HeroSection({ cards, catalogueSize }: { cards: CardFace[]; catalogueSize: number }) {
  const facts = [
    { icon: Gift, text: "100 % gratuit, sans achat" },
    { icon: Clock, text: "Un pack toutes les 10 min" },
    { icon: Layers, text: `${catalogueSize.toLocaleString("fr-FR")} vraies voitures` },
  ];
  return (
    <section className="relative overflow-hidden pb-6 sm:pb-12">
      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-5 pt-8 text-center sm:px-6 sm:pt-16">
        <h1 className="title-drop max-w-5xl text-balance font-display text-[clamp(2rem,6.2vw,4.75rem)] leading-[1.02]">
          <span className="block">Toutes les cultures auto.</span>
          <span className="block text-accent">Une seule collection.</span>
        </h1>
        <p className="mt-4 max-w-xl text-pretty font-semibold text-muted sm:mt-5 sm:text-lg">
          Le jeu de cartes à collectionner des fans d&apos;automobile. JDM, muscle cars,
          exotiques européennes, youngtimers : ouvre des boosters, échange, construis ton garage.
        </p>
        <DiscordButton label="Jouer avec Discord" className="mt-6 sm:mt-8" />
        <ul className="mt-5 flex flex-wrap justify-center gap-1.5 sm:mt-6 sm:gap-2">
          {facts.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-2.5 py-1 text-xs font-extrabold ring-1 ring-white/10 sm:px-3 sm:py-1.5 sm:text-sm"
            >
              <Icon className="size-4 text-accent" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
      </div>

      <HeroCards cards={cards} />
    </section>
  );
}
