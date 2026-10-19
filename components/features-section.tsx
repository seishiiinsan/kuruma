import { ArrowLeftRight, ChevronRight, Plus } from "lucide-react";
import { COLLECT, GARAGE, HAND, TRADE } from "@/lib/showcase";
import { ScrollReveal } from "./scroll-reveal";
import { TradingCard } from "./trading-card";

/** Nine scenes in one hand, fanned across the table. Fixed offsets, scaled as a unit. */
function Hand() {
  const cards = HAND();
  const mid = (cards.length - 1) / 2;
  return (
    <div className="relative mx-auto h-[150px] max-w-6xl sm:h-[230px] lg:h-[330px]">
      <div className="absolute inset-x-0 top-6 origin-top scale-[0.4] sm:scale-[0.64] lg:scale-100">
        {cards.map((card, i) => {
          const d = i - mid;
          return (
            <div
              key={card.slug}
              className="absolute left-1/2 top-0 z-[var(--z)] hover:z-30"
              style={{
                ["--z" as string]: 10 - Math.abs(Math.round(d)),
                transform: `translateX(calc(-50% + ${d * 118}px)) translateY(${d * d * 5}px) rotate(${d * 5}deg)`,
              }}
            >
              {/* Hovered card comes to the front and lifts, so its full name shows. */}
              <div className="transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-6">
                <TradingCard card={card} className="w-40" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniFan() {
  return (
    <div className="relative h-36 w-48" aria-hidden>
      {COLLECT().map((card, i) => {
        const [x, rotate, y] = ([[-46, -10, 12], [0, 0, 0], [46, 10, 12]] as const)[i];
        return (
          <div
            key={card.slug}
            className="absolute left-1/2 top-0"
            style={{ transform: `translateX(calc(-50% + ${x}px)) translateY(${y}px) rotate(${rotate}deg)` }}
          >
            <TradingCard card={card} interactive={false} className="w-24" />
          </div>
        );
      })}
    </div>
  );
}

function MiniTrade() {
  const [left, right] = TRADE();
  return (
    <div className="flex h-36 items-center gap-2" aria-hidden>
      <TradingCard card={left} interactive={false} className="w-24 -rotate-6" />
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink shadow-[0_3px_0_var(--accent-edge)]">
        <ArrowLeftRight className="size-5" strokeWidth={2.6} />
      </span>
      <TradingCard card={right} interactive={false} className="w-24 rotate-6" />
    </div>
  );
}

function MiniGarage() {
  return (
    <div className="panel-sunken grid h-36 grid-cols-4 items-center gap-1.5 px-2" aria-hidden>
      {GARAGE().map((card) => (
        <TradingCard key={card.slug} card={card} interactive={false} className="w-[3.25rem] sm:w-14" />
      ))}
      <span className="flex aspect-[5/7] w-[3.25rem] items-center justify-center rounded-[10px] border-2 border-dashed border-white/25 text-muted sm:w-14">
        <Plus className="size-4" />
      </span>
    </div>
  );
}

const LOOP = [
  {
    title: "Collectionne",
    body: "Chaque carte est un exemplaire numéroté, jamais plus qu'il n'en a été construit.",
    visual: <MiniFan />,
  },
  {
    title: "Échange",
    body: "Propose tes doubles à un autre collectionneur, jusqu'à 5 cartes de chaque côté.",
    visual: <MiniTrade />,
  },
  {
    title: "Expose",
    body: "Ton garage public : six cartes, dans l'ordre que tu veux, sur ton profil.",
    visual: <MiniGarage />,
  },
];

export function FeaturesSection() {
  return (
    <section className="overflow-hidden py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="title-drop text-balance font-display text-3xl sm:text-[2.6rem] sm:leading-[1.1]">
            De la kei car à l&apos;hypercar, tout tient dans une main
          </h2>
          <p className="mt-4 text-pretty text-muted">
            JDM, muscle, euro, kei cars, youngtimers, bloc de l&apos;Est : aucune scène n&apos;est oubliée.
          </p>
        </div>
      </div>

      <div className="mt-6 sm:mt-10">
        <Hand />
      </div>

      <div className="mx-auto mt-6 max-w-6xl px-5 sm:mt-10 sm:px-6">
        <ScrollReveal>
          <ol className="panel grid gap-2 p-4 sm:p-6 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-center lg:gap-4">
            {LOOP.map((step, i) => (
              <li key={step.title} className="contents">
                {i > 0 && (
                  <span aria-hidden className="flex justify-center text-accent">
                    <ChevronRight className="size-8 rotate-90 lg:rotate-0" strokeWidth={3} />
                  </span>
                )}
                <div className="flex flex-col items-center gap-4 rounded-2xl px-2 py-4 text-center">
                  {step.visual}
                  <div>
                    <h3 className="title-drop font-display text-2xl">{step.title}</h3>
                    <p className="mx-auto mt-2 max-w-xs text-pretty text-sm text-muted">{step.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </ScrollReveal>
      </div>
    </section>
  );
}
