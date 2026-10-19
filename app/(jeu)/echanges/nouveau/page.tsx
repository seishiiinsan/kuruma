import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCopiesOf, getLeaderboard, getPlayerByHandle, getViewer } from "@/lib/game";
import { toStacks } from "@/lib/stacks";
import { PlayerPicker } from "@/components/game/player-picker";
import { TradeComposer } from "@/components/game/trade-composer";
import { TrustNotice } from "@/components/game/trust-notice";
import { PageHeader } from "@/components/game/ui";

export const metadata: Metadata = { title: "Nouvel échange — Kuruma" };

type Search = { avec?: string; carte?: string };

async function Composer({ searchParams }: { searchParams: Promise<Search> }) {
  const { avec, carte } = await searchParams;
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");

  const partner = avec ? await getPlayerByHandle(avec) : null;

  if (!partner || partner.id === viewer.id) {
    const players = (await getLeaderboard(200)).filter((p) => p.id !== viewer.id);
    return (
      <>
        <PageHeader
          title="Avec qui échanger ?"
          description="Choisis un collectionneur pour voir ses cartes. Astuce : depuis la fiche d'une voiture, tu vois directement qui la possède."
        />
        <PlayerPicker players={players} />
      </>
    );
  }

  const [theirs, mine] = await Promise.all([getCopiesOf(partner.id), getCopiesOf(viewer.id)]);
  return (
    <TradeComposer
      partner={partner}
      theirs={toStacks(theirs)}
      mine={toStacks(mine)}
      wanted={carte ?? null}
    />
  );
}

export default function NewTradePage({ searchParams }: PageProps<"/echanges/nouveau">) {
  return (
    <>
      <Link
        href="/echanges"
        className="btn btn-sm mb-8"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Échanges
      </Link>
      <Suspense fallback={null}>
        <TrustNotice showLimits />
      </Suspense>
      <Suspense fallback={<div className="h-96 panel-sunken animate-pulse" />}>
        <Composer searchParams={searchParams as Promise<Search>} />
      </Suspense>
    </>
  );
}
