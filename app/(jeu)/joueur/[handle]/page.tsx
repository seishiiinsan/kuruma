import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftRight, Palette, Settings, ShieldCheck, Trophy } from "lucide-react";
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
import { getFriends, getFriendship, getPlayerFriends } from "@/lib/friends";
import { garageSlots, gradeOf } from "@/lib/permit";
import { seriesById } from "@/lib/series";
import { toStacks } from "@/lib/stacks";
import { formatMonthYear } from "@/lib/time";
import { BadgeRow, FramedAvatar, PlayerTitle, bannerPaint } from "@/components/cosmetics";
import { RarityDiamonds } from "@/components/rarity-diamonds";
import { TradingCard } from "@/components/trading-card";
import { FriendButton } from "@/components/game/friend-button";
import { FriendList } from "@/components/game/friend-list";
import { GarageEditor } from "@/components/game/garage-editor";
import { LevelDisc, PermitPanel, PermitProgress } from "@/components/game/permit";
import { ShowMore } from "@/components/game/show-more";
import { ReportButton } from "@/components/game/report-button";
import { EmptyState, SectionTitle, Skeleton, buttonGhost, buttonInk, buttonPrimary, formatScore } from "@/components/game/ui";

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
    <Suspense fallback={<Skeleton className="h-72 sm:h-64" />}>
      <PlayerProfile params={params} />
    </Suspense>
  );
}

/** Cards shown before the "show more" button, and the most the page ever lists. */
const FIRST_CARDS = 24;
const MAX_CARDS = 48;

async function PlayerProfile({ params }: { params: Promise<{ handle: string }> }) {
  const player = await getPlayerByHandle((await params).handle);
  if (!player) notFound();

  const [viewer, account, copies, garage, board, claims, friends] = await Promise.all([
    getViewer(),
    getAccount(),
    getCopiesOf(player.id),
    getGarage(player.id),
    getLeaderboard(1, [player.id]),
    getClaims(player.id),
    getPlayerFriends(player.id),
  ]);
  const completed = [...claims.keys()].flatMap((id) => seriesById(id) ?? []);
  const isMe = viewer?.id === player.id;
  const [permit, friendship, mine] = await Promise.all([
    isMe ? getMyPermit() : null,
    viewer && !isMe ? getFriendship(viewer.id, player.id) : ("none" as const),
    viewer && !isMe ? getFriends(viewer.id) : null,
  ]);
  const mutual = new Set(mine?.friends.filter((f) => friends.some((g) => g.id === f.id)).map((f) => f.id));
  const level = permit?.level ?? player.level;
  const grade = gradeOf(level);
  const slots = garageSlots(level);
  const standing = board.find((s) => s.id === player.id);
  const stacks = toStacks(copies).sort(
    (a, b) => byRarity(a.card, b.card) || a.copies[0].serial - b.copies[0].serial,
  );

  const banner = bannerPaint(player.look);

  const stats: [string, ReactNode][] = [
    ["Classement", standing ? `#${standing.rank}` : "—"],
    ["Score", formatScore(standing?.score ?? 0)],
    [
      "Voitures",
      <>
        {formatScore(stacks.length)}
        <span className="ml-1 text-sm text-muted">/ {formatScore(CATALOGUE_SIZE)}</span>
      </>,
    ],
    ["Séries terminées", formatScore(completed.length)],
  ];

  const cardList = (list: typeof stacks) => (
    <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
      {list.map(({ card, copies }) => (
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
  );
  const shown = stacks.slice(0, MAX_CARDS);

  return (
    <>
      {/* Header: who this is, what they can do here, and where they stand. */}
      <header className="panel relative overflow-hidden p-5 sm:p-8" style={banner ? { background: banner } : undefined}>
        {banner ? (
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-deep/90 via-bg-deep/40 to-bg-deep/10" />
        ) : (
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -left-16 size-72 rounded-full bg-[radial-gradient(circle,rgb(255_191_46/0.25),transparent_70%)]"
          />
        )}

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-8">
          <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-6">
            <div className="relative shrink-0">
              <FramedAvatar player={player} size={96} className="ring-4 ring-accent shadow-[var(--shadow-card)]" />
              <LevelDisc level={level} className="absolute -right-1.5 -bottom-1.5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="title-drop font-display text-[2rem] leading-[1.05] text-balance break-words sm:text-[2.75rem]">
                {player.name}
              </h1>
              {player.look?.titleId && <PlayerTitle look={player.look} className="mt-1 block sm:text-lg" />}
              <p className={`mt-1.5 text-sm sm:text-base ${banner ? "text-ink/85" : "text-muted"}`}>
                <span className="font-extrabold whitespace-nowrap" style={{ color: grade.tint }}>
                  {grade.name}
                </span>
                {" · "}
                <span className="inline-block max-w-full truncate align-bottom">@{player.handle}</span>
                <span className="hidden sm:inline"> · collectionne depuis {formatMonthYear(player.memberSince)}</span>
              </p>
              {mutual.size > 0 && (
                <a href="#amis" className={`mt-1 inline-block text-sm font-bold hover:underline ${banner ? "text-ink" : "text-accent"}`}>
                  {mutual.size} {mutual.size > 1 ? "amis" : "ami"} en commun
                </a>
              )}
              <BadgeRow look={player.look} size={30} className="mt-3 flex-wrap" />
            </div>
          </div>

          {isMe ? (
            <div className="flex items-center gap-2 sm:self-start">
              <Link href="/personnaliser" className={`${buttonInk} flex-1 sm:flex-none`}>
                <Palette className="size-4" aria-hidden />
                Personnaliser
              </Link>
              <Link href="/parametres" className={`${buttonGhost} size-11 p-0`} aria-label="Paramètres" title="Paramètres">
                <Settings className="size-5" aria-hidden />
              </Link>
              {account?.admin && (
                <Link href="/admin" className={`${buttonGhost} size-11 p-0`} aria-label="Modération" title="Modération">
                  <ShieldCheck className="size-5" aria-hidden />
                </Link>
              )}
            </div>
          ) : viewer ? (
            <div className="flex flex-col gap-3 sm:items-end sm:self-start">
              <Link href={`/echanges/nouveau?avec=${player.handle}`} className={`${buttonPrimary} whitespace-nowrap`}>
                <ArrowLeftRight className="size-4" aria-hidden />
                Proposer un échange
              </Link>
              <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-2">
                <FriendButton playerId={player.id} playerName={player.name} status={friendship} />
                <ReportButton playerId={player.id} playerName={player.name} />
              </div>
            </div>
          ) : null}
        </div>

        {permit && <PermitProgress permit={permit} href="#permis" className="relative mt-5 sm:max-w-md" />}

        <dl className="relative mt-5 grid grid-cols-2 gap-2 sm:mt-6 sm:grid-cols-4">
          {stats.map(([label, value]) => (
            <div key={label} className={`panel-sunken px-4 py-3 ${banner ? "bg-bg-deep/70 backdrop-blur-sm" : ""}`}>
              <dt className="text-xs font-bold text-muted">{label}</dt>
              <dd className="title-drop mt-0.5 font-display text-xl tabular-nums sm:text-2xl">{value}</dd>
            </div>
          ))}
        </dl>
        <p className={`relative mt-3 text-xs sm:hidden ${banner ? "text-ink/75" : "text-muted"}`}>
          Collectionne depuis {formatMonthYear(player.memberSince)}
        </p>
      </header>

      {/* The showcase: what the player chose to show off. */}
      <section aria-labelledby="garage" className="mt-12 sm:mt-14">
        <SectionTitle
          id="garage"
          count={isMe ? `${garage.length} / ${slots}` : garage.length > 0 ? String(garage.length) : undefined}
          detail={
            isMe
              ? `Ta vitrine publique : jusqu'à ${slots} cartes, dans l'ordre que tu veux.`
              : `Les cartes que ${player.name} expose.`
          }
        >
          Garage
        </SectionTitle>
        <div className="mt-5">
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

      {/* Who they play with; signed-out visitors don't see friend lists. */}
      {viewer && (
        <section aria-labelledby="amis" className="mt-12 sm:mt-14">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionTitle
              id="amis"
              count={friends.length > 0 ? formatScore(friends.length) : undefined}
              detail={
                isMe
                  ? "Les joueurs avec qui tu échanges. Ajoute-en depuis leur profil."
                  : mutual.size > 0
                    ? `Dont ${mutual.size} en commun avec toi, entourés en jaune.`
                    : undefined
              }
            >
              Amis
            </SectionTitle>
            {isMe && friends.length > 0 && (
              <Link href="/classement?vue=amis" className="btn btn-sm">
                <Trophy className="size-4" aria-hidden />
                Classement entre amis
              </Link>
            )}
          </div>
          <div className="mt-5">
            {friends.length > 0 ? (
              <FriendList friends={friends} mutual={mutual} />
            ) : isMe ? (
              <EmptyState
                title="Pas encore d'amis."
                action={
                  <Link href="/classement" className={buttonGhost}>
                    <Trophy className="size-4" aria-hidden />
                    Trouver des joueurs au classement
                  </Link>
                }
              >
                Ouvre le profil d&apos;un joueur et ajoute-le : vous pourrez échanger et vous comparer.
              </EmptyState>
            ) : (
              <p className="text-sm text-muted">{player.name} n&apos;a pas encore d&apos;amis.</p>
            )}
          </div>
        </section>
      )}

      {/* Progression, for the player's own eyes only. */}
      {permit && (
        <section id="permis" aria-labelledby="permis-titre" className="mt-12 scroll-mt-24 sm:mt-14">
          <SectionTitle
            id="permis-titre"
            detail="Joue pour gagner de l'XP : chaque permis débloque des places au garage, des réductions et des cosmétiques."
          >
            Permis
          </SectionTitle>
          <div className="mt-5">
            <PermitPanel player={player} permit={permit} />
          </div>
        </section>
      )}

      {/* Everything they hold, rarest first, with the series they finished. */}
      <section aria-labelledby="collection" className="mt-12 sm:mt-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <SectionTitle
            id="collection"
            count={formatScore(stacks.length)}
            detail={`${formatScore(copies.length)} exemplaires, les plus rares d'abord.`}
          >
            Collection
          </SectionTitle>
          {isMe && (
            <Link href="/collection" className="btn btn-sm">
              Gérer ma collection
            </Link>
          )}
        </div>

        <ul className="mt-4 flex flex-wrap gap-2 text-sm" aria-label="Voitures par rareté">
          {TIER_ORDER.toReversed().map((t) => (
            <li key={t} className="hud-pill h-9 gap-2 pr-3.5 pl-3">
              <RarityDiamonds tier={t} size={8} />
              <span className="font-bold text-muted">{TIERS[t].label}</span>
              <span>{stacks.filter((s) => s.card.tier === t).length}</span>
            </li>
          ))}
        </ul>

        {completed.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-extrabold">
              Séries terminées <span className="text-muted tabular-nums">{completed.length}</span>
            </h3>
            <ul className="mt-2 flex flex-wrap gap-2">
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
          </div>
        )}

        {stacks.length === 0 ? (
          <div className="mt-6">
            <EmptyState title="Aucune carte pour l'instant." />
          </div>
        ) : (
          <>
            <div className="mt-6">{cardList(shown.slice(0, FIRST_CARDS))}</div>
            {shown.length > FIRST_CARDS && (
              <ShowMore label={`Voir ${shown.length - FIRST_CARDS} cartes de plus`}>
                <div className="mt-5">{cardList(shown.slice(FIRST_CARDS))}</div>
                {stacks.length > MAX_CARDS && (
                  <p className="mt-6 text-sm text-muted">
                    Et {formatScore(stacks.length - MAX_CARDS)} autres voitures, des moins rares.
                  </p>
                )}
              </ShowMore>
            )}
          </>
        )}
      </section>
    </>
  );
}
