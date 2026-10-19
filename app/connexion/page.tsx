import { Suspense } from "react";
import type { Metadata } from "next";
import { LOGIN } from "@/lib/showcase";
import { DiscordButton } from "@/components/discord-button";
import { TradingCard } from "@/components/trading-card";

export const metadata: Metadata = {
  title: "Connexion — Kuruma",
};

const ERRORS: Record<string, string> = {
  discord: "Impossible de joindre Discord. Réessaie dans un instant.",
  callback: "La connexion avec Discord n'a pas abouti. Réessaie.",
};

async function LoginError({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  if (!erreur) return null;
  return (
    <p role="alert" className="mt-4 text-sm font-bold text-danger">
      {ERRORS[erreur] ?? ERRORS.callback}
    </p>
  );
}

export default function LoginPage({ searchParams }: PageProps<"/connexion">) {
  return (
    <section className="flex flex-1 items-center justify-center px-5 py-16 sm:py-24">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="relative mb-10 h-44 w-56" aria-hidden>
          {LOGIN().map((card, i) => {
            const [x, rotate, y] = ([[-58, -9, 10], [58, 9, 10], [0, 0, 0]] as const)[i];
            return (
            <div
              key={card.slug}
              className="absolute left-1/2 top-0"
              style={{
                transform: `translateX(calc(-50% + ${x}px)) translateY(${y}px) rotate(${rotate}deg)`,
              }}
            >
              <TradingCard card={card} interactive={false} className="w-28" />
            </div>
            );
          })}
        </div>

        <h1 className="text-balance font-display text-3xl font-bold tracking-[-0.03em]">
          Connecte-toi
        </h1>
        <p className="mt-3 text-balance text-muted">
          Tes 10 premiers packs sont prêts. Ta collection, ton garage et tes
          échanges sont liés à ton compte Discord.
        </p>

        <DiscordButton className="mt-8" />

        <Suspense fallback={null}>
          <LoginError
            searchParams={searchParams as Promise<{ erreur?: string }>}
          />
        </Suspense>

        <p className="mt-6 max-w-sm text-sm text-muted">
          On récupère seulement ton nom, ton avatar et ton email Discord.
          Ton nom et ton avatar s&apos;affichent sur ton profil public.
        </p>
      </div>
    </section>
  );
}
