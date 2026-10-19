import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { CARDS, CATALOGUE_SIZE } from "@/lib/catalog";
import { byRarity, toFace } from "@/lib/cards";
import { getClaims, getOwnedSlugs, getViewer } from "@/lib/game";
import { SERIES, progressOf, type SeriesProgress } from "@/lib/series";
import { TradingCard } from "@/components/trading-card";
import { ClaimButton } from "@/components/game/claim-button";
import { CollectionTabs } from "@/components/game/collection-tabs";
import { SeriesTile } from "@/components/game/series-tile";
import { PageHeader, formatScore } from "@/components/game/ui";

export const metadata: Metadata = { title: "Album — Kuruma" };

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const SEARCH_LIMIT = 48;

function Section({ title, detail, children }: { title: string; detail?: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 first:mt-0">
      <h2 className="title-drop font-display text-xl sm:text-2xl">{title}</h2>
      {detail && <p className="mt-1 text-sm text-muted">{detail}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Tiles({ list, owned }: { list: SeriesProgress[]; owned: Set<string> }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {list.map((s) => (
        <li key={s.id}>
          <SeriesTile series={s} owned={owned} />
        </li>
      ))}
    </ul>
  );
}

async function Album({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const viewer = await getViewer();
  const [owned, claims] = viewer
    ? await Promise.all([getOwnedSlugs(viewer.id), getClaims(viewer.id)])
    : [new Set<string>(), new Map<string, string>()];

  const all = SERIES.map((s) => progressOf(s, owned, claims));
  const toClaim = all.filter((s) => s.complete && !s.claimedAt);
  const started = all
    .filter((s) => s.owned > 0 && !s.complete)
    .sort((a, b) => b.owned / b.cards.length - a.owned / a.cards.length);
  const done = all.filter((s) => s.claimedAt).length;

  const query = normalize(q.trim());
  const results = query
    ? CARDS.filter((card) => normalize(`${card.name} ${card.brand ?? ""}`).includes(query))
        .sort((a, b) => Number(owned.has(b.slug)) - Number(owned.has(a.slug)) || byRarity(a, b))
    : [];

  return (
    <>
      <dl className="grid max-w-2xl grid-cols-3 gap-2">
        {(
          [
            ["Séries terminées", `${done} / ${SERIES.length}`],
            ["En cours", String(started.length)],
            ["Voitures", `${formatScore(owned.size)} / ${formatScore(CATALOGUE_SIZE)}`],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="panel-sunken px-4 py-3">
            <dt className="text-xs font-medium text-muted">{label}</dt>
            <dd className="mt-0.5 title-drop font-display text-2xl tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <form action="/album" className="relative mt-8 max-w-2xl" role="search">
        <label htmlFor="album-search" className="sr-only">
          Chercher une voiture dans tout le catalogue
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          id="album-search"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={`Chercher parmi les ${formatScore(CATALOGUE_SIZE)} voitures`}
          className="field pl-10"
        />
      </form>

      <div className="mt-12">
        {query ? (
          <Section
            title={`${results.length} voiture${results.length > 1 ? "s" : ""} pour « ${q.trim()} »`}
            detail={results.length > SEARCH_LIMIT ? `Les ${SEARCH_LIMIT} premières, celles que tu as d'abord.` : undefined}
          >
            {results.length === 0 ? (
              <p className="text-muted">
                Aucune voiture ne correspond.{" "}
                <Link href="/album" className="font-semibold text-ink underline underline-offset-4">
                  Revenir à l&apos;album
                </Link>
              </p>
            ) : (
              <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {results.slice(0, SEARCH_LIMIT).map((card) => (
                  <li key={card.slug}>
                    <Link href={`/cartes/${card.slug}`} className="block">
                      <TradingCard card={toFace(card)} interactive={false} missing={!owned.has(card.slug)} className="w-full" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        ) : (
          <>
            {toClaim.length > 0 && (
              <Section title="Récompenses à réclamer">
                <ul className="flex flex-col gap-3">
                  {toClaim.map((s) => (
                    <li
                      key={s.id}
                      className="flex flex-col gap-3 panel p-4 ring-2 ring-accent sm:flex-row sm:items-center sm:justify-between"
                    >
                      <p>
                        <Link href={`/album/${s.id}`} className="font-semibold hover:underline">
                          {s.name}
                        </Link>{" "}
                        <span className="text-sm text-muted">terminée · +{s.points} pts au classement</span>
                      </p>
                      <ClaimButton seriesId={s.id} packs={s.packs} />
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {started.length > 0 && (
              <Section title="En cours" detail="Les plus avancées d'abord.">
                <Tiles list={started.slice(0, 8)} owned={owned} />
              </Section>
            )}

            <Section
              title="Thèmes"
              detail="Les voitures construites à moins de 5 000 exemplaires ne comptent dans aucune série : elles se chassent à part."
            >
              <Tiles list={all.filter((s) => s.kind === "theme")} owned={owned} />
            </Section>

            <Section title="Marques" detail="Les grandes marques sont découpées par époque.">
              <Tiles list={all.filter((s) => s.kind === "brand")} owned={owned} />
            </Section>
          </>
        )}
      </div>
    </>
  );
}

export default function AlbumPage({ searchParams }: PageProps<"/album">) {
  return (
    <>
      <CollectionTabs />
      <PageHeader
        title="Album"
        description="Toutes les voitures du jeu, rangées en séries. Termine une série pour gagner des packs bonus et des points au classement."
      />
      <Suspense fallback={<div className="h-96 panel-sunken animate-pulse" />}>
        <Album searchParams={searchParams as Promise<{ q?: string }>} />
      </Suspense>
    </>
  );
}
