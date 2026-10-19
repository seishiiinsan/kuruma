import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftRight, Palette, Settings, ShieldCheck } from "lucide-react";
import { CATALOGUE_SIZE } from "@/lib/catalog";
import { byRarity, TIERS, TIER_ORDER } from "@/lib/cards";
import {
  getAccount,
  getClaims,
  getCopiesOf,
  getGarage,
  getLeaderboard,
  getMyPermit,
  getPlayerByHandle,
  getViewer,
} from "@/lib/game";
import { garageSlots } from "@/lib/permit";
import { seriesById } from "@/lib/series";
import { toStacks } from "@/lib/stacks";
import { formatMonthYear } from "@/lib/time";
import { BadgeRow, FramedAvatar, PlayerTitle, bannerPaint } from "@/components/cosmetics";
import { RarityDiamonds } from "@/components/rarity-diamonds";
import { TradingCard } from "@/components/trading-card";
import { GarageEditor } from "@/components/game/garage-editor";
import { PermitChip, PermitPanel } from "@/components/game/permit";
import { ReportButton } from "@/components/game/report-button";
import { EmptyState, buttonGhost, buttonInk, formatScore } from "@/components/game/ui";

export async function generateMetadata({
  params,
}: PageProps<"/joueur/[handle]">): Promise<Metadata> {
  const player = await getPlayerByHandle((await params).handle);
  if (!player) return { title: "Joueur — Kuruma" };
  const description = `Le garage et la collection de ${player.name} (@${player.handle}) sur Kuruma, le jeu de cartes auto.`;
  return {
    title: `${player.name} — Kuruma`,
    description,
    alternates: { canonical: `/joueur/${player.handle}` },
    openGraph: { type: "profile", siteName: "Kuruma", locale: "fr_FR", title: player.name, description },
    twitter: { card: "summary_large_image", title: player.name, description },
  };
}

export default function PlayerPage({ params }: PageProps<"/joueur/[handle]">) {
  return (
    <Suspense fallback={<div className="size-22 animate-pulse rounded-full bg-surface-lo" />}>
      <PlayerProfile params={params} />
    </Suspense>
  );
}

async function PlayerProfile({ params }: { params: Promise<{ handle: string }> }) {
  const player = await getPlayerByHandle((await params).handle);
  if (!player) notFound();

  const [viewer, account, copies, garage, board, claims] = await Promise.all([
    getViewer(),
    getAccount(),
    getCopiesOf(player.id),
    getGarage(player.id),
    getLeaderboard(1000),
    getClaims(player.id),
  ]);
  const completed = [...claims.keys()].flatMap((id) => seriesById(id) ?? []);
  const isMe = viewer?.id === player.id;
  const permit = isMe ? await getMyPermit() : null;
  const level = permit?.level ?? player.level;
  const slots = garageSlots(level);
  const standing = board.find((s) => s.id === player.id);
  const stacks = toStacks(copies).sort(
    (a, b) => byRarity(a.card, b.card) || a.copies[0].serial - b.copies[0].serial,
  );

  const banner = bannerPaint(player.look);

  const stats: [string, string][] = [
    ["Classement", standing ? `#${standing.rank}` : "—"],
    ["Score", formatScore(standing?.score ?? 0)],
    ["Voitures", `${stacks.length} / ${formatScore(CATALOGUE_SIZE)}`],
    ["Exemplaires", formatScore(copies.length)],
  ];

  return (
    <>
      <div className="panel relative overflow-hidden p-5 sm:p-8" style={banner ? { background: banner } : undefined}>
      {banner ? (
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-deep/85 via-bg-deep/30 to-transparent" />
      ) : (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-16 size-72 rounded-full bg-[radial-gradient(circle,rgb(255_191_46/0.25),transparent_70%)]"
        />
      )}
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
        <FramedAvatar player={player} size={104} className="ring-4 ring-accent shadow-[var(--shadow-card)]" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="title-drop font-display text-[2rem] leading-[1.05] sm:text-[2.75rem]">
              {player.name}
            </h1>
            <BadgeRow look={player.look} size={32} />
          </div>
          {player.look?.titleId && <PlayerTitle look={player.look} className="mt-1 block text-lg" />}
          <p className={`mt-2 ${banner ? "text-ink/80" : "text-muted"}`}>
            @{player.handle} · collectionne depuis {formatMonthYear(player.memberSince)}
          </p>
          <PermitChip level={level} className="mt-3" />
        </div>
        {isMe ? (
          <div className="flex flex-wrap gap-2 self-start sm:flex-col sm:self-center">
            <Link href="/personnaliser" className={buttonInk}>
              <Palette className="size-4" aria-hidden />
              Personnaliser
            </Link>
            <Link href="/parametres" className={buttonGhost}>
              <Settings className="size-4" aria-hidden />
              Paramètres
            </Link>
            {account?.admin && (
              <Link href="/admin" className={buttonGhost}>
                <ShieldCheck className="size-4" aria-hidden />
                Modération
              </Link>
            )}
          </div>
        ) : viewer ? (
          <div className="flex flex-col items-start gap-2 self-start sm:items-end sm:self-center">
            <Link href={`/echanges/nouveau?avec=${player.handle}`} className={buttonInk}>
              <ArrowLeftRight className="size-4" aria-hidden />
              Proposer un échange
            </Link>
            <ReportButton playerId={player.id} playerName={player.name} />
          </div>
        ) : null}
      </div>

      <dl className="relative mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className={`panel-sunken px-4 py-3 ${banner ? "bg-bg-deep/70 backdrop-blur-sm" : ""}`}>
            <dt className="text-xs font-bold text-muted">{label}</dt>
            <dd className="title-drop mt-0.5 font-display text-2xl tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      </div>

      {permit && (
        <section className="mt-14">
          <h2 className="title-drop font-display text-xl sm:text-2xl">Permis</h2>
          <p className="mt-1 text-sm text-muted">Joue pour gagner de l&apos;XP : chaque permis débloque des places au garage, des réductions et des cosmétiques.</p>
          <div className="mt-6">
            <PermitPanel player={player} permit={permit} />
          </div>
        </section>
      )}

      <section className="mt-14">
        <h2 className="title-drop font-display text-xl sm:text-2xl">Garage</h2>
        <p className="mt-1 text-sm text-muted">
          {isMe
            ? `Ta vitrine publique : jusqu'à ${slots} cartes, dans l'ordre que tu veux.`
            : `Les cartes que ${player.name} expose.`}
        </p>
        <div className="mt-6">
          {isMe ? (
            <GarageEditor garage={garage} stacks={stacks} slots={slots} />
          ) : garage.length > 0 ? (
            <ul className="grid grid-cols-2 gap-x-5 gap-y-8 panel p-6 sm:grid-cols-3 sm:p-10 lg:grid-cols-6">
              {garage.map((copy) => (
                <li key={copy.id}>
                  <Link href={`/cartes/${copy.card.slug}`} className="block">
                    <TradingCard card={copy.card} serial={copy.serial} finish={copy.finish} className="w-full" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title={`${player.name} n'expose encore rien.`} />
          )}
        </div>
      </section>

      {completed.length > 0 && (
        <section className="mt-14">
          <h2 className="title-drop font-display text-xl sm:text-2xl">
            Séries terminées <span className="text-muted tabular-nums">{completed.length}</span>
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {completed.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/album/${s.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface-lo px-3.5 py-1.5 text-sm font-extrabold transition-colors hover:bg-surface-hi"
                >
                  <span aria-hidden className="size-2 rounded-full bg-green" />
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="title-drop font-display text-xl sm:text-2xl">Collection</h2>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {TIER_ORDER.toReversed().map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <RarityDiamonds tier={t} size={8} />
                  <span className="text-muted">{TIERS[t].label}</span>
                  <span className="font-black tabular-nums">
                    {stacks.filter((s) => s.card.tier === t).length}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {isMe && (
            <Link href="/collection" className="btn btn-sm">
              Gérer ma collection
            </Link>
          )}
        </div>

        {stacks.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="Aucune carte pour l'instant." />
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {stacks.slice(0, 48).map(({ card, copies }) => (
              <li key={card.slug} className="relative">
                <Link href={`/cartes/${card.slug}`} className="block">
                  <TradingCard card={card} serial={copies[0].serial} finish={copies[0].finish} interactive={false} className="w-full" />
                </Link>
                {copies.length > 1 && (
                  <span className="absolute -top-1.5 -right-1.5 z-10 rounded-full bg-accent px-1.5 py-0.5 text-[0.65rem] font-black text-accent-ink tabular-nums shadow-[0_2px_0_var(--accent-edge)]">
                    ×{copies.length}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        {stacks.length > 48 && (
          <p className="mt-6 text-sm text-muted">
            Et {stacks.length - 48} autres voitures, des moins rares.
          </p>
        )}
      </section>
    </>
  );
}
