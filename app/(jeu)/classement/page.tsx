import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { TIER_ORDER, TIERS } from "@/lib/cards";
import { getLeaderboard, getViewer, type Standing } from "@/lib/game";
import { Avatar } from "@/components/avatar";
import { BadgeRow, FramedAvatar, PlayerTitle } from "@/components/cosmetics";
import { RarityDiamonds } from "@/components/rarity-diamonds";
import { EmptyState, PageHeader, buttonPrimary, formatScore } from "@/components/game/ui";

export const metadata: Metadata = { title: "Classement — Kuruma" };

const PODIUM = [
  { face: "#ffcc33", edge: "#c98200", ink: "#3b1f00" },
  { face: "#dfe3f2", edge: "#8d94b3", ink: "#1a1442" },
  { face: "#f0a061", edge: "#a9561b", ink: "#2d1300" },
];

function Rank({ rank }: { rank: number }) {
  return (
    <span
      className={`inline-flex size-8 items-center justify-center rounded-full font-display text-sm tabular-nums ${
        rank > 3 ? "bg-bg-deep text-muted" : ""
      }`}
      style={
        rank <= 3
          ? { background: PODIUM[rank - 1].face, color: PODIUM[rank - 1].ink, boxShadow: `0 2px 0 ${PODIUM[rank - 1].edge}` }
          : undefined
      }
    >
      {rank}
    </span>
  );
}

const rowClass =
  "grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[2.5rem_1fr_6rem_6rem_6rem]";

function Row({ standing, isMe }: { standing: Standing; isMe: boolean }) {
  return (
    <li className={`${rowClass} ${isMe ? "bg-accent/10 ring-2 ring-accent ring-inset" : ""}`} aria-current={isMe ? "true" : undefined}>
      <Rank rank={standing.rank} />
      <Link href={`/joueur/${standing.handle}`} className="group flex min-w-0 items-center gap-3">
        <FramedAvatar player={standing} size={40} />
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate font-extrabold group-hover:underline">{standing.name}</span>
            <BadgeRow look={standing.look} size={20} className="hidden shrink-0 sm:flex" />
          </span>
          {standing.look?.titleId && <PlayerTitle look={standing.look} className="block truncate text-xs" />}
        </span>
        {isMe && (
          <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-black text-accent-ink">
            TOI
          </span>
        )}
      </Link>
      <span className="hidden text-right text-sm tabular-nums sm:block">{formatScore(standing.distinctCards)}</span>
      <span className="hidden text-right text-sm text-muted tabular-nums sm:block">{formatScore(standing.series)}</span>
      <span className="text-right font-display tabular-nums">{formatScore(standing.score)}</span>
    </li>
  );
}

async function Board() {
  const [viewer, standings] = await Promise.all([getViewer(), getLeaderboard(50)]);
  const top = standings.filter((s) => s.rank <= 50);
  const me = standings.find((s) => s.id === viewer?.id);
  const meOutsideTop = me && me.rank > 50;
  // Steps only make sense once three players can stand on them.
  const podium = top.length >= 3;

  if (top.length === 0) {
    return (
      <EmptyState
        title="Personne n'a encore de carte."
        action={
          <Link href="/boosters" className={buttonPrimary}>
            Ouvrir le premier pack
          </Link>
        }
      >
        Le premier à ouvrir un pack prend la tête.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {podium && <Podium standings={top.slice(0, 3)} viewerId={viewer?.id} />}
      {(!podium || top.length > 3 || meOutsideTop || (viewer && !me)) && (
    <div className="panel overflow-hidden">
      <div className={`${rowClass} border-b border-white/10 text-xs font-black uppercase tracking-wider text-muted`}>
        <span>#</span>
        <span>Joueur</span>
        <span className="hidden text-right sm:block">Voitures</span>
        <span className="hidden text-right sm:block">Séries</span>
        <span className="text-right">Score</span>
      </div>
      <ol className="divide-y divide-white/10">
        {top.slice(podium ? 3 : 0).map((standing) => (
          <Row key={standing.id} standing={standing} isMe={standing.id === viewer?.id} />
        ))}
        {meOutsideTop && (
          <>
            <li className="px-4 py-1.5 text-center text-muted" aria-hidden>
              …
            </li>
            <Row standing={me} isMe />
          </>
        )}
      </ol>
      {viewer && !me && (
        <p className="border-t border-white/10 px-4 py-3 text-sm text-muted">
          Tu n&apos;es pas encore classé :{" "}
          <Link href="/boosters" className="font-semibold text-ink underline underline-offset-4">
            ouvre un pack
          </Link>{" "}
          pour entrer au classement.
        </p>
      )}
    </div>
      )}
    </div>
  );
}

/** The top three on steps, the leader tallest: rank reads as size. */
function Podium({ standings, viewerId }: { standings: Standing[]; viewerId?: string }) {
  const order = [standings[1], standings[0], standings[2]];
  const step = ["h-20 sm:h-24", "h-28 sm:h-32", "h-14 sm:h-16"];
  return (
    <ol className="mx-auto grid w-full max-w-2xl grid-cols-3 items-end gap-2 sm:gap-4" aria-label="Podium">
      {order.map((standing, i) => {
        if (!standing) return <li key={i} aria-hidden />;
        const medal = PODIUM[standing.rank - 1];
        const lead = standing.rank === 1;
        return (
          <li key={standing.id} className={`flex flex-col items-center text-center ${lead ? "" : "pt-6"}`}>
            <Link href={`/joueur/${standing.handle}`} className="group flex min-w-0 flex-col items-center gap-2 px-1">
              <span className="relative rounded-full p-1" style={{ background: medal.face, boxShadow: `0 3px 0 ${medal.edge}` }}>
                <Avatar player={standing} size={lead ? 88 : 64} />
                <span
                  className="absolute -bottom-2 left-1/2 flex size-8 -translate-x-1/2 items-center justify-center rounded-full font-display text-sm"
                  style={{ background: medal.face, color: medal.ink, boxShadow: `0 2px 0 ${medal.edge}` }}
                >
                  {standing.rank}
                </span>
              </span>
              <span className="mt-2 max-w-full truncate font-extrabold group-hover:underline">
                {standing.name}
                {standing.id === viewerId && <span className="text-accent"> · toi</span>}
              </span>
              {standing.look?.titleId && <PlayerTitle look={standing.look} className="-mt-1.5 max-w-full truncate text-xs" />}
            </Link>
            <span className="title-drop font-display text-lg tabular-nums sm:text-2xl">{formatScore(standing.score)}</span>
            <span
              aria-hidden
              className={`mt-2 w-full rounded-t-2xl ${step[i]}`}
              style={{ background: `linear-gradient(180deg, ${medal.face}, ${medal.edge})`, boxShadow: "inset 0 2px 0 rgb(255 255 255 / 0.45)" }}
            />
          </li>
        );
      })}
    </ol>
  );
}

export default function LeaderboardPage() {
  return (
    <>
      <PageHeader
        title="Classement"
        description={
          <>
            Chaque voiture différente rapporte des points selon sa rareté, et chaque{" "}
            <Link href="/album" className="font-semibold text-ink underline-offset-4 hover:underline">
              série terminée
            </Link>{" "}
            ajoute un bonus. Les doubles ne comptent pas : échange-les contre ce qui te manque.
          </>
        }
      />
      <ul className="mb-8 flex flex-wrap gap-2 text-sm font-bold">
        {TIER_ORDER.map((t) => (
          <li key={t} className="flex items-center gap-2 rounded-full bg-surface-lo px-3 py-1.5">
            <RarityDiamonds tier={t} size={8} />
            <span className="text-muted">{TIERS[t].label}</span>
            <span className="font-black tabular-nums">{TIERS[t].points} pts</span>
          </li>
        ))}
      </ul>
      <Suspense fallback={<div className="h-96 panel-sunken animate-pulse" />}>
        <Board />
      </Suspense>
    </>
  );
}
