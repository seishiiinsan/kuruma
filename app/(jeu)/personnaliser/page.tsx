import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMyCosmetics } from "@/lib/cosmetics-server";
import { EMPTY_LOOK } from "@/lib/cosmetics";
import { getViewer } from "@/lib/game";
import { getWallet } from "@/lib/packs-server";
import { getMyAchievements } from "@/lib/shop";
import { PageHeader } from "@/components/game/ui";
import { Wardrobe } from "@/components/game/wardrobe";

export const metadata: Metadata = { title: "Personnaliser mon profil — Kuruma" };

async function Body() {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  const [owned, wallet, { metrics }] = await Promise.all([
    getMyCosmetics(),
    getWallet(),
    getMyAchievements(viewer.id),
  ]);
  return (
    <Wardrobe
      player={viewer}
      look={viewer.look ?? EMPTY_LOOK}
      owned={Object.fromEntries([...owned].map(([id, o]) => [id, { fresh: o.fresh }]))}
      metrics={metrics}
      wallet={wallet}
    />
  );
}

export default function CustomizePage() {
  return (
    <>
      <PageHeader
        title="Personnaliser"
        description="Titres, badges, cadres et bannières : certains se débloquent en jouant, d'autres s'achètent avec tes jetons. Ton look s'affiche sur ton profil et au classement."
      />
      <Suspense fallback={<div className="h-96 panel-sunken animate-pulse" />}>
        <Body />
      </Suspense>
    </>
  );
}
