import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowLeftRight, ExternalLink } from "lucide-react";
import { cardBySlug } from "@/lib/catalog";
import { FINISHES, TIERS, formatInt, formatSerial, toFace, type CardData, type Finish } from "@/lib/cards";
import { getCardCirculation, getGarage, getViewer, isWished, type PlayerRef } from "@/lib/game";
import { seriesOfCard } from "@/lib/series";
import { Avatar } from "@/components/avatar";
import { RarityDiamonds } from "@/components/rarity-diamonds";
import { TradingCard } from "@/components/trading-card";
import { ShowcaseButton } from "@/components/game/showcase-button";
import { WishButton } from "@/components/game/wish-button";
import { ListingRow, MarketLink, QuoteBreakdown, QuoteChart, SellForm } from "@/components/game/market";
import { Coins } from "@/components/game/coins";
import { QUOTE_DAYS } from "@/lib/market";
import { getWallet } from "@/lib/packs-server";
import { getHistory, getListingsOf, getQuote } from "@/lib/shop";
import { buttonInk } from "@/components/game/ui";

export async function generateMetadata({
  params,
}: PageProps<"/cartes/[slug]">): Promise<Metadata> {
  const card = cardBySlug((await params).slug);
  if (!card) return { title: "Carte — Kuruma" };
  const tagline = `${TIERS[card.tier].label} · ${card.culture}${card.supply ? ` · ${formatInt(card.supply)} construits` : ""}`;
  return {
    title: `${card.name} — Kuruma`,
    description: card.description,
    alternates: { canonical: `/cartes/${card.slug}` },
    openGraph: { type: "website", siteName: "Kuruma", locale: "fr_FR", title: card.name, description: tagline },
    twitter: { card: "summary_large_image", title: card.name, description: tagline },
  };
}

export default function CardPage({ params }: PageProps<"/cartes/[slug]">) {
  return (
    <>
      <Link
        href="/collection"
        className="btn btn-sm mb-8"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Collection
      </Link>
      <Suspense fallback={<div className="aspect-[5/7] w-64 animate-pulse rounded-[14px] bg-surface-lo sm:w-80" />}>
        <CardDetail params={params} />
      </Suspense>
    </>
  );
}

function specs(card: CardData): [string, string][] {
  const years =
    card.year && card.yearEnd && card.yearEnd !== card.year
      ? `${card.year} – ${card.yearEnd}`
      : card.year
        ? card.yearEnd
          ? String(card.year)
          : `Depuis ${card.year}`
        : null;
  const rows: [string, string | null][] = [
    ["Marque", card.brand],
    ["Production", years],
    ["Pays", card.country],
    ["Culture", card.culture],
    ["Carrosserie", card.body],
    ["Moteur", card.engine],
    ["Cylindrée", card.displacementCc ? `${(card.displacementCc / 1000).toFixed(1).replace(".", ",")} L` : null],
    ["Puissance", card.powerHp ? `${formatInt(card.powerHp)} ch` : null],
    ["Vitesse max", card.topSpeedKmh ? `${formatInt(Math.round(card.topSpeedKmh))} km/h` : null],
    ["0 à 100 km/h", card.zeroTo100 ? `${String(card.zeroTo100).replace(".", ",")} s` : null],
    ["Poids", card.massKg ? `${formatInt(card.massKg)} kg` : null],
    ["Construits", card.supply ? `${formatInt(card.supply)} ex.` : null],
  ];
  return rows.filter((row): row is [string, string] => row[1] !== null);
}

/** The last cell stretches so the grid never shows an empty gap. */
function fillRow(count: number) {
  const mobile = count % 2 === 1 ? "col-span-2" : "";
  const desktop = ["sm:col-span-1", "sm:col-span-3", "sm:col-span-2"][count % 3];
  return `${mobile} ${desktop}`;
}

async function CardDetail({ params }: { params: Promise<{ slug: string }> }) {
  const card = cardBySlug((await params).slug);
  if (!card) notFound();

  const [viewer, circulation, listings, quote, history] = await Promise.all([
    getViewer(),
    getCardCirculation(card.slug),
    getListingsOf(card.slug),
    getQuote(card.slug),
    getHistory(card.slug, 90),
  ]);
  const wallet = viewer ? await getWallet() : null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  // Rare prints first, then the lowest number: the copy worth showing.
  const mine = viewer
    ? circulation.copies
        .filter((c) => c.owner?.id === viewer.id)
        .sort((a, b) => Number(a.finish === "standard") - Number(b.finish === "standard") || a.serial - b.serial)
    : [];
  // Every print of the car, how many came out, and how many are the viewer's.
  const variants = (["standard", "holo", "vintage"] as const).map((finish) => ({
    finish,
    out: circulation.copies.filter((c) => c.finish === finish).length,
    mine: mine.filter((c) => c.finish === finish).length,
  }));
  const [garage, wished] = await Promise.all([
    viewer && mine.length > 0 ? getGarage(viewer.id) : [],
    viewer && mine.length === 0 ? isWished(viewer.id, card.slug) : false,
  ]);
  const shown = garage.find((copy) => copy.card.slug === card.slug);

  // Other owners, most copies first: the people to ask for a trade.
  const owners = new Map<string, { player: PlayerRef; serials: { serial: number; finish: Finish }[] }>();
  for (const copy of circulation.copies) {
    if (!copy.owner || copy.owner.id === viewer?.id) continue;
    const entry = owners.get(copy.owner.id) ?? { player: copy.owner, serials: [] };
    entry.serials.push({ serial: copy.serial, finish: copy.finish });
    owners.set(copy.owner.id, entry);
  }
  const others = [...owners.values()].sort((a, b) => b.serials.length - a.serials.length);

  const left = card.supply ? card.supply - circulation.minted : null;
  // Listed copies have no owner either: only the rest sit in the shop.
  const listed = new Set(listings.map((l) => l.id));
  const inShop = circulation.copies.filter((c) => c.inShop && !listed.has(c.id)).length;

  return (
    <div className="flex flex-col items-center gap-12 lg:flex-row lg:items-start lg:gap-16">
      <div className="flex shrink-0 flex-col items-center gap-4 lg:sticky lg:top-24">
        <TradingCard
          card={toFace(card)}
          serial={mine[0]?.serial}
          finish={mine[0]?.finish}
          className="w-64 sm:w-80"
          priority
        />
        <p className="max-w-80 text-center text-xs text-muted">
          Photo{card.photo.author ? ` : ${card.photo.author}` : ""}
          {card.photo.license && (
            <>
              {" · "}
              {card.photo.licenseUrl ? (
                <a href={card.photo.licenseUrl} className="underline underline-offset-2 hover:text-ink">
                  {card.photo.license}
                </a>
              ) : (
                card.photo.license
              )}
            </>
          )}
          {" · "}
          <a href={card.photo.source} className="underline underline-offset-2 hover:text-ink">
            Wikimedia Commons
          </a>
        </p>
      </div>

      <div className="w-full min-w-0 flex-1">
        <h1 className="title-drop text-balance font-display text-[2rem] leading-[1.05] sm:text-[2.75rem]">
          {card.name}
        </h1>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm font-black">
          <span
            className="inline-flex items-center gap-2 rounded-full bg-surface-lo px-3 py-1.5"
            style={{ color: TIERS[card.tier].color }}
          >
            <RarityDiamonds tier={card.tier} size={11} />
            {TIERS[card.tier].label}
          </span>
          <span className="rounded-full bg-surface-lo px-3 py-1.5">{card.culture}</span>
        </p>
        <p className="mt-4 max-w-xl text-muted">
          {card.description}{" "}
          <a
            href={card.source.url}
            className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-extrabold text-accent underline-offset-4 hover:underline"
          >
            Wikipédia{card.source.lang === "en" ? " (en)" : ""}
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </p>

        <dl className="mt-8 grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-3">
          {specs(card).map(([label, value], i, all) => (
            <div key={label} className={`panel-sunken px-4 py-3 ${i === all.length - 1 ? fillRow(all.length) : ""}`}>
              <dt className="text-xs font-bold text-muted">{label}</dt>
              <dd className="mt-0.5 font-extrabold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <section className="mt-10 max-w-xl panel p-5 ">
          <h2 className="title-drop font-display text-lg">Dans le jeu</h2>
          <p className="mt-1 text-sm text-muted">
            {circulation.minted === 0
              ? "Personne ne l'a encore tirée."
              : `${formatInt(circulation.minted)} exemplaire${circulation.minted > 1 ? "s" : ""} en circulation`}
            {left !== null &&
              (left > 0
                ? ` · encore ${formatInt(left)} à sortir des packs et de la boutique, pas un de plus qu'en vrai.`
                : " · épuisée : elle ne s'obtient plus que par échange ou d'occasion.")}
          </p>
          {inShop > 0 && (
            <p className="mt-1 text-sm">
              <Link href="/boutique#occasions" className="font-semibold underline underline-offset-4">
                {inShop} exemplaire{inShop > 1 ? "s" : ""} d&apos;occasion en boutique
              </Link>
            </p>
          )}

          {viewer ? (
            mine.length > 0 ? (
              <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm">
                  <span className="font-semibold">Tu en as {mine.length}</span>
                  <span className="text-muted">
                    {" "}:{" "}
                    <CopyLinks slug={card.slug} supply={card.supply} copies={mine} />
                  </span>
                </p>
                <ShowcaseButton
                  copyId={mine[0].id}
                  garage={garage.map((copy) => copy.id)}
                  shownCopyId={shown?.id ?? null}
                />
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold">Tu ne l&apos;as pas encore.</p>
                {listings.some((l) => l.seller?.id === viewer.id) ? (
                  <p className="text-sm text-muted">Ton exemplaire est en vente.</p>
                ) : (
                  <WishButton slug={card.slug} wished={wished} />
                )}
              </div>
            )
          ) : (
            <p className="mt-4 border-t border-white/10 pt-4 text-sm">
              <Link href="/connexion" className="font-semibold underline underline-offset-4">
                Connecte-toi
              </Link>{" "}
              pour la chercher dans tes packs.
            </p>
          )}
        </section>

        <section className="mt-10 max-w-xl">
          <h2 className="title-drop font-display text-lg sm:text-xl">Variantes</h2>
          <p className="mt-1 text-sm text-muted">
            Même voiture, trois tirages. Le tirage se décide à l&apos;ouverture : chaque copie a sa chance.
          </p>
          <ul className="mt-4 grid grid-cols-3 gap-3 sm:gap-5">
            {variants.map((v) => (
              <li key={v.finish} className="flex flex-col gap-2">
                {/* Never pulled yet: shown as it would look, held back. */}
                <div className={v.out === 0 ? "opacity-45" : undefined}>
                  <TradingCard card={toFace(card)} finish={v.finish} className="w-full" />
                </div>
                <div className="text-center text-xs leading-snug sm:text-sm">
                  <p className="font-extrabold">{FINISHES[v.finish].label}</p>
                  <p className="text-muted">
                    {v.finish === "standard" ? "Tirage courant" : `1 copie sur ${Math.round(1 / FINISHES[v.finish].odds)}`}
                  </p>
                  <p className="mt-0.5 text-muted tabular-nums">
                    {v.out === 0 ? "Jamais tirée" : `${formatInt(v.out)} sortie${v.out > 1 ? "s" : ""}`}
                  </p>
                  {v.mine > 0 && (
                    <p className="mt-1.5 inline-block rounded-full bg-green px-2 py-0.5 font-black text-[var(--green-ink)] shadow-[0_2px_0_var(--green-edge)]">
                      {v.mine > 1 ? `Tu en as ${v.mine}` : "Tu l'as"}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10 max-w-xl panel p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="title-drop font-display text-lg">Marché</h2>
            <MarketLink />
          </div>
          {quote && (
            <>
              <p className="mt-1 text-sm text-muted">
                Cote <Coins amount={quote.reference} className="font-black text-ink" />
                {quote.sales === 0
                  ? " · aucune vente entre joueurs sur 30 jours : c'est sa valeur de base."
                  : ` · sa valeur de base, corrigée par ${quote.sales} vente${quote.sales > 1 ? "s" : ""} entre joueurs sur ${QUOTE_DAYS} jours.`}
              </p>
              <QuoteBreakdown
                quote={quote}
                tierLabel={TIERS[card.tier].label}
                supply={card.supply}
                minted={circulation.minted}
                listings={listings.length}
              />
            </>
          )}
          <div className="mt-5">
            <QuoteChart history={history} today={today} />
          </div>

          <h3 className="mt-6 text-sm font-extrabold">
            En vente{listings.length > 0 && <span className="text-muted"> · {listings.length}</span>}
          </h3>
          {listings.length === 0 ? (
            <p className="mt-1 text-sm text-muted">Personne ne la vend en ce moment.</p>
          ) : (
            <ul className="mt-2 divide-y divide-white/10 overflow-hidden rounded-xl bg-bg-deep/50">
              {listings.map((listing) => (
                <ListingRow
                  key={listing.id}
                  listing={listing}
                  supply={card.supply}
                  mine={listing.seller?.id === viewer?.id}
                  wallet={wallet}
                />
              ))}
            </ul>
          )}

          {quote && mine.length > 0 && (
            <div className="mt-6 border-t border-white/10 pt-5">
              <h3 className="mb-3 text-sm font-extrabold">Vendre la tienne</h3>
              <SellForm
                copies={mine.map((c) => ({ id: c.id, serial: c.serial }))}
                supply={card.supply}
                quote={quote}
              />
            </div>
          )}
        </section>

        {seriesOfCard(card.slug).length > 0 ? (
          <p className="mt-4 max-w-xl text-sm text-muted">
            Fait partie de la série{" "}
            {seriesOfCard(card.slug).map((s, i) => (
              <span key={s.id}>
                {i > 0 && ", "}
                <Link href={`/album/${s.id}`} className="font-semibold text-ink underline-offset-4 hover:underline">
                  {s.name}
                </Link>
              </span>
            ))}
            .
          </p>
        ) : (
          card.supply !== null &&
          card.supply < 5000 && (
            <p className="mt-4 max-w-xl text-sm text-muted">
              Trop rare pour une série : elle se chasse à part.
            </p>
          )
        )}

        {others.length > 0 && (
          <section className="mt-10 max-w-xl">
            <h2 className="title-drop font-display text-lg sm:text-xl">
              Ils l&apos;ont
            </h2>
            <ul className="mt-4 divide-y divide-white/10 overflow-hidden panel ">
              {others.slice(0, 12).map(({ player, serials }) => (
                <li key={player.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Link href={`/joueur/${player.handle}`} className="shrink-0">
                      <Avatar player={player} size={36} />
                    </Link>
                    <span className="min-w-0">
                      <Link
                        href={`/joueur/${player.handle}`}
                        className="block truncate font-extrabold hover:underline"
                      >
                        {player.name}
                      </Link>
                      <span className="block truncate text-sm text-muted">
                        <CopyLinks slug={card.slug} supply={card.supply} copies={serials} />
                      </span>
                    </span>
                  </div>
                  {viewer && (
                    <Link
                      href={`/echanges/nouveau?avec=${player.handle}&carte=${card.slug}`}
                      className={`${buttonInk} btn-sm shrink-0`}
                    >
                      <ArrowLeftRight className="size-4" aria-hidden />
                      <span className="hidden sm:inline">Proposer un échange</span>
                      <span className="sm:hidden">Échanger</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

/** Each number links to that copy's page and the players it went through. */
function CopyLinks({
  slug,
  supply,
  copies,
}: {
  slug: string;
  supply: number | null;
  copies: { serial: number; finish: Finish }[];
}) {
  return copies.map((c, i) => (
    <span key={c.serial}>
      {i > 0 && ", "}
      <Link
        href={`/cartes/${slug}/${c.serial}`}
        className="tabular-nums underline decoration-white/25 underline-offset-4 hover:text-ink hover:decoration-current"
      >
        {formatSerial(c.serial, supply)}
        {c.finish !== "standard" && ` ${FINISHES[c.finish].label.toLowerCase()}`}
      </Link>
    </span>
  ));
}
