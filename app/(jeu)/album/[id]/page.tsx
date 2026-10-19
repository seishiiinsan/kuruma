import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { cardBySlug } from "@/lib/catalog";
import { formatSerial, toFace } from "@/lib/cards";
import { getClaims, getCopiesOf, getOwnerCounts, getViewer } from "@/lib/game";
import { progressOf, seriesById } from "@/lib/series";
import { formatMonthYear } from "@/lib/time";
import { TradingCard } from "@/components/trading-card";
import { ClaimButton } from "@/components/game/claim-button";

export async function generateMetadata({ params }: PageProps<"/album/[id]">): Promise<Metadata> {
  const series = seriesById((await params).id);
  return { title: series ? `Série ${series.name} — Kuruma` : "Série — Kuruma" };
}

export default function SeriesPage({ params }: PageProps<"/album/[id]">) {
  return (
    <>
      <Link
        href="/album"
        className="btn btn-sm mb-8"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Album
      </Link>
      <Suspense fallback={<div className="h-96 panel-sunken animate-pulse" />}>
        <SeriesDetail params={params} />
      </Suspense>
    </>
  );
}

async function SeriesDetail({ params }: { params: Promise<{ id: string }> }) {
  const series = seriesById((await params).id);
  if (!series) notFound();

  const viewer = await getViewer();
  const [copies, claims, ownerCounts] = await Promise.all([
    viewer ? getCopiesOf(viewer.id) : Promise.resolve([]),
    viewer ? getClaims(viewer.id) : Promise.resolve(new Map<string, string>()),
    getOwnerCounts(series.cards),
  ]);

  // Best (lowest) serial held of each car.
  const best = new Map<string, number>();
  for (const copy of copies) {
    const current = best.get(copy.card.slug);
    if (current === undefined || copy.serial < current) best.set(copy.card.slug, copy.serial);
  }
  const progress = progressOf(series, new Set(best.keys()), claims);
  const missing = series.cards.length - progress.owned;
  const pct = Math.round((progress.owned / series.cards.length) * 100);

  return (
    <>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="title-drop text-balance font-display text-[2rem] leading-[1.05] sm:text-[2.75rem]">
            {series.name}
          </h1>
          <p className="mt-2 text-sm font-bold text-muted">
            {series.kind === "brand" ? "Série marque" : "Série thème"} · {series.cards.length} voitures
          </p>
          <div className="mt-4 flex max-w-md items-center gap-3">
            <div className={`gauge flex-1 ${progress.complete ? "gauge-green" : ""}`}>
              <span style={{ width: `${pct}%` }} />
            </div>
            <span className="text-sm font-semibold tabular-nums">
              {progress.owned}/{series.cards.length}
            </span>
          </div>
        </div>

        <div className="panel p-5  lg:w-80">
          <p className="text-sm font-semibold">
            Récompense : {series.packs} pack{series.packs > 1 ? "s" : ""} bonus · +{series.points} pts
          </p>
          <div className="mt-3">
            {!viewer ? (
              <p className="text-sm text-muted">
                <Link href="/connexion" className="font-semibold text-ink underline underline-offset-4">
                  Connecte-toi
                </Link>{" "}
                pour compléter cette série.
              </p>
            ) : progress.claimedAt ? (
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <Check className="size-4 text-green" aria-hidden />
                Réclamée en {formatMonthYear(progress.claimedAt)}.
              </p>
            ) : progress.complete ? (
              <ClaimButton seriesId={series.id} packs={series.packs} />
            ) : (
              <p className="text-sm text-muted">
                Il te manque {missing} voiture{missing > 1 ? "s" : ""}. Ouvre une carte manquante pour voir qui
                l&apos;a et lui proposer un échange.
              </p>
            )}
          </div>
        </div>
      </div>

      <ul className="mt-10 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {series.cards.map((slug) => {
          const card = cardBySlug(slug);
          if (!card) return null;
          const serial = best.get(slug);
          const owners = ownerCounts.get(slug) ?? 0;
          const otherOwners = serial === undefined ? owners : owners - 1;
          return (
            <li key={slug}>
              <Link href={`/cartes/${slug}`} className="block">
                <TradingCard
                  card={toFace(card)}
                  serial={serial}
                  missing={serial === undefined}
                  interactive={serial !== undefined}
                  className="w-full"
                />
              </Link>
              <p className="mt-2 text-center text-xs font-bold text-muted">
                {serial !== undefined
                  ? `À toi · ${formatSerial(serial, card.supply)}`
                  : otherOwners > 0
                    ? `${otherOwners} joueur${otherOwners > 1 ? "s l'ont" : " l'a"}`
                    : "Personne ne l'a encore"}
              </p>
            </li>
          );
        })}
      </ul>
    </>
  );
}
