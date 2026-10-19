import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MAX_WISHES, getViewer, getWishLeads, getWishes } from "@/lib/game";
import { CollectionTabs } from "@/components/game/collection-tabs";
import { EmptyState, PageHeader, buttonPrimary } from "@/components/game/ui";
import { TradingCard } from "@/components/trading-card";

export const metadata: Metadata = { title: "Envies — Kuruma" };

async function Wishes() {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  const cards = await getWishes(viewer.id);
  const leads = await getWishLeads(cards.map((c) => c.slug));

  if (cards.length === 0) {
    return (
      <EmptyState
        title="Aucune envie pour l'instant"
        action={
          <Link href="/album" className={buttonPrimary}>
            Parcourir l&apos;album
          </Link>
        }
      >
        Sur la fiche d&apos;une voiture que tu n&apos;as pas, touche « Ajouter à mes envies ». On te prévient quand elle passe en
        boutique, en occasion, ou chez un joueur qui en a un double.
      </EmptyState>
    );
  }

  return (
    <>
      <p className="mb-6 text-sm text-muted tabular-nums">
        {cards.length} / {MAX_WISHES} voitures. Une voiture quitte la liste dès que tu l&apos;obtiens.
      </p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {cards.map((card) => {
          const lead = leads.get(card.slug)!;
          return (
            <li key={card.slug} className="flex flex-col gap-2">
              <Link href={`/cartes/${card.slug}`} className="block">
                <TradingCard card={card} className="w-full" missing />
              </Link>
              <p className="text-center text-xs font-bold text-muted">
                {lead.used > 0 ? (
                  <Link href="/boutique#occasions" className="text-green underline-offset-4 hover:underline">
                    {lead.used} en occasion
                  </Link>
                ) : lead.doubles > 0 ? (
                  <Link href={`/cartes/${card.slug}`} className="text-accent underline-offset-4 hover:underline">
                    {lead.doubles} joueur{lead.doubles > 1 ? "s" : ""} avec un double
                  </Link>
                ) : (
                  "Personne n'en a de double"
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default function WishesPage() {
  return (
    <>
      <CollectionTabs />
      <PageHeader
        title="Tes envies"
        description="Les voitures que tu cherches. On te prévient quand l'une d'elles passe en boutique, en occasion, ou chez un joueur qui en a un double."
      />
      <Suspense fallback={<div className="h-96 panel-sunken animate-pulse" />}>
        <Wishes />
      </Suspense>
    </>
  );
}
