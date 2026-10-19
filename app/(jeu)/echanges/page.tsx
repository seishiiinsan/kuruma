import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { getTrades, getViewer } from "@/lib/game";
import { Tabs } from "@/components/game/tabs";
import { TradeList } from "@/components/game/trade-list";
import { TrustNotice } from "@/components/game/trust-notice";
import { EmptyState, PageHeader, buttonInk, buttonPrimary } from "@/components/game/ui";

export const metadata: Metadata = { title: "Échanges — Kuruma" };

async function Board() {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  const trades = await getTrades(viewer.id);

  const received = trades.filter((t) => t.status === "pending" && !t.outgoing);
  const sent = trades.filter((t) => t.status === "pending" && t.outgoing);
  const history = trades.filter((t) => t.status !== "pending");

  return (
    <Tabs
      tabs={[
        {
          label: "À traiter",
          count: received.length,
          content: (
            <TradeList
              trades={received}
              empty={
                <EmptyState title="Aucune offre à traiter.">
                  Quand un joueur voudra une de tes cartes, son offre apparaîtra ici.
                </EmptyState>
              }
            />
          ),
        },
        {
          label: "Envoyées",
          count: sent.length,
          content: (
            <TradeList
              trades={sent}
              empty={
                <EmptyState
                  title="Aucune offre en cours."
                  action={
                    <Link href="/echanges/nouveau" className={buttonInk}>
                      Proposer un échange
                    </Link>
                  }
                >
                  Une voiture te manque ? Ouvre sa fiche pour voir qui l&apos;a, ou choisis un joueur.
                </EmptyState>
              }
            />
          ),
        },
        {
          label: "Historique",
          content: (
            <TradeList
              trades={history}
              empty={<EmptyState title="Aucun échange terminé pour l'instant." />}
            />
          ),
        },
      ]}
    />
  );
}

export default function TradesPage() {
  return (
    <>
      <PageHeader
        title="Échanges"
        description="Échange tes doubles contre les voitures qui te manquent. Jusqu'à 5 cartes de chaque côté ; rien ne bouge tant que l'autre n'a pas accepté."
        action={
          <Link href="/echanges/nouveau" className={buttonPrimary}>
            <Plus className="size-4" aria-hidden />
            Nouvel échange
          </Link>
        }
      />
      <Suspense fallback={null}>
        <TrustNotice showLimits />
      </Suspense>
      <Suspense fallback={<div className="h-96 panel-sunken animate-pulse" />}>
        <Board />
      </Suspense>
    </>
  );
}
