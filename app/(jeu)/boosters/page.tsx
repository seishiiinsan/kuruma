import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAccount } from "@/lib/game";
import { weekendOf } from "@/lib/packs";
import { salonOf } from "@/lib/salons";
import { getWallet } from "@/lib/packs-server";
import { PackShop } from "@/components/game/pack-shop";

export const metadata: Metadata = { title: "Boosters — Kuruma" };

async function Shop({ searchParams }: { searchParams: Promise<{ pack?: string }> }) {
  const { pack } = await searchParams;
  const [wallet, account] = await Promise.all([getWallet(), getAccount()]);
  if (account && !account.onboarded) redirect("/bienvenue");
  return <PackShop initialWallet={wallet} initialPack={pack} weekend={weekendOf()} salon={salonOf()} />;
}

export default function BoostersPage({ searchParams }: PageProps<"/boosters">) {
  return (
    // Desktop: the whole shop fits the viewport (header 4rem + layout padding 7rem).
    <div className="flex flex-col lg:h-[calc(100dvh-11rem)] lg:min-h-[38rem]">
      <Suspense fallback={<div className="h-96 panel-sunken animate-pulse lg:h-full" />}>
        <Shop searchParams={searchParams as Promise<{ pack?: string }>} />
      </Suspense>
    </div>
  );
}
