import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCopiesOf, getLeaderboard, getPlayerByHandle, getViewer, type Standing } from "@/lib/game";
import { getFriends } from "@/lib/friends";
import { toStacks } from "@/lib/stacks";
import { FriendRequests, PlayerPicker } from "@/components/game/player-picker";
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
    // Friends only here; any profile still offers a trade with its owner.
    const { friends, received } = await getFriends(viewer.id);
    const board = await getLeaderboard(1, friends.map((f) => f.id));
    const standings = new Map(board.map((s) => [s.id, s]));
    const players: Standing[] = friends.map(
      (f) => standings.get(f.id) ?? { ...f, rank: 0, score: 0, distinctCards: 0, copies: 0, series: 0 },
    );
    return (
      <>
        <PageHeader
          title="Avec qui échanger ?"
          description="Choisis un ami pour voir ses cartes. Pour échanger avec un autre joueur, passe par son profil : depuis la fiche d'une voiture, tu vois qui la possède."
        />
        <FriendRequests players={received} />
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
