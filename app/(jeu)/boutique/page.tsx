import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Palette } from "lucide-react";
import { getCopiesOf, getViewer } from "@/lib/game";
import { getWallet } from "@/lib/packs-server";
import { getDuplicates, getMarketListings, getMyListings, getShopWindow, getUsedStock } from "@/lib/shop";
import { CoinBalance } from "@/components/game/coins";
import { Shop } from "@/components/game/shop";
import { TrustNotice } from "@/components/game/trust-notice";
import { PageHeader } from "@/components/game/ui";

export const metadata: Metadata = { title: "Boutique — Kuruma" };

async function Balance() {
  return <CoinBalance wallet={await getWallet()} />;
}

async function Body() {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  const [wallet, offers, stock, copies, listings, myListings] = await Promise.all([
    getWallet(),
    getShopWindow(),
    getUsedStock(),
    getCopiesOf(viewer.id),
    getMarketListings(),
    getMyListings(viewer.id),
  ]);
  const duplicates = await getDuplicates(viewer.id, copies);
  return (
    <Shop
      wallet={wallet}
      offers={offers}
      stock={stock}
      listings={listings}
      myListings={myListings}
      owned={[...new Set(copies.map((c) => c.card.slug))]}
      duplicates={duplicates}
    />
  );
}

export default function ShopPage() {
  return (
    <>
      <PageHeader
        title="Boutique"
        description="Tes jetons se gagnent en jouant : succès, missions, prime du jour, ventes. Ils achètent des voitures choisies, celles des autres joueurs, des occasions et des packs."
        action={
          <Suspense fallback={<div className="h-[4.25rem] w-32 panel-sunken animate-pulse" />}>
            <Balance />
          </Suspense>
        }
      />
      <Link
        href="/personnaliser"
        className="group panel mb-10 flex items-center gap-4 p-4 transition-[transform,filter] duration-200 hover:-translate-y-0.5 hover:brightness-110 sm:p-5"
        style={{
          background:
            "radial-gradient(circle at 92% 50%, rgb(199 125 255 / 0.35), transparent 50%), linear-gradient(180deg, var(--surface-hi), var(--surface) 38%)",
        }}
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[conic-gradient(from_0deg,#ff6b6b,#ffd93d,#6bff95,#4fb0ff,#c77dff,#ff6b6b)] p-1">
          <span className="flex size-full items-center justify-center rounded-full bg-bg-deep">
            <Palette className="size-5" aria-hidden />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="title-drop block font-display text-lg leading-tight">Titres, badges, cadres et bannières</span>
          <span className="block text-pretty text-sm text-muted">
            Habille ton profil : certains se débloquent en jouant, les autres s&apos;achètent ici avec tes jetons.
          </span>
        </span>
        <span className="btn btn-sm hidden sm:inline-flex">Personnaliser</span>
      </Link>
      <Suspense fallback={null}>
        <TrustNotice />
      </Suspense>
      <Suspense fallback={<div className="h-96 panel-sunken animate-pulse" />}>
        <Body />
      </Suspense>
    </>
  );
}
