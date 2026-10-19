import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CATALOGUE_SIZE } from "@/lib/catalog";
import { getAccount, getViewer } from "@/lib/game";
import { getWallet } from "@/lib/packs-server";
import { tradeBlockText } from "@/lib/trust";
import { Welcome } from "@/components/game/welcome";

export const metadata: Metadata = { title: "Bienvenue — Kuruma", robots: { index: false } };

async function Tour() {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  const [account, wallet] = await Promise.all([getAccount(), getWallet()]);
  return (
    <Welcome
      name={viewer.name}
      catalogueSize={CATALOGUE_SIZE}
      initialWallet={wallet}
      tradeNote={tradeBlockText(account)}
    />
  );
}

export default function WelcomePage() {
  return (
    <div className="flex min-h-[60dvh] items-center py-4 sm:py-10">
      <Suspense fallback={<div className="mx-auto h-96 w-full max-w-2xl panel-sunken animate-pulse" />}>
        <Tour />
      </Suspense>
    </div>
  );
}
