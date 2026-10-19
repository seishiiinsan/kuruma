import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CATALOGUE_SIZE, CULTURES } from "@/lib/catalog";
import { getCopiesOf, getViewer } from "@/lib/game";
import { toStacks } from "@/lib/stacks";
import { CollectionGrid } from "@/components/game/collection-grid";
import { CollectionTabs } from "@/components/game/collection-tabs";
import { PageHeader } from "@/components/game/ui";

export const metadata: Metadata = { title: "Collection — Kuruma" };

async function Grid() {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  const stacks = toStacks(await getCopiesOf(viewer.id));
  return <CollectionGrid stacks={stacks} catalogueSize={CATALOGUE_SIZE} cultures={CULTURES} />;
}

export default function CollectionPage() {
  return (
    <>
      <CollectionTabs />
      <PageHeader
        title="Ta collection"
        description="Chaque carte est un exemplaire numéroté. Ouvre une carte pour voir sa fiche, l'exposer dans ton garage ou trouver qui d'autre la possède."
      />
      <Suspense fallback={<div className="h-96 panel-sunken animate-pulse" />}>
        <Grid />
      </Suspense>
    </>
  );
}
