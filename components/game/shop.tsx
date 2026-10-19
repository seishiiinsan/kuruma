"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, Recycle } from "lucide-react";
import { buyListing, buyOffer, buyUsed, sellCopy, sellDuplicates } from "@/app/actions/economy";
import { TIERS, TIER_ORDER, type CardFace, type CardTier } from "@/lib/cards";
import { SELL_PRICE, USED_PRICE } from "@/lib/economy";
import type { Copy } from "@/lib/game";
import { PACKS, packSize, type Wallet } from "@/lib/packs";
import { MARKET_DAYS, MARKET_FEE_RATE, MAX_LISTINGS } from "@/lib/market";
import type { Listing, Offer } from "@/lib/shop";
import { useWallet } from "@/lib/wallet-store";
import { RarityDiamonds } from "../rarity-diamonds";
import { TradingCard } from "../trading-card";
import { Coins } from "./coins";
import { EmptyState, buttonGhost, buttonPrimary } from "./ui";
import { ListingRow } from "./market";
import { useEconomy } from "./use-economy";

const int = new Intl.NumberFormat("fr-FR");

function Feedback({ result }: { result: { ok: boolean; text: string } | null }) {
  if (!result) return null;
  return (
    <p role={result.ok ? "status" : "alert"} className={`text-xs ${result.ok ? "text-muted" : "font-bold text-danger"}`}>
      {result.text}
    </p>
  );
}

/** A card for sale: the card, its price, and the buy button. */
function ForSale({
  card,
  serial,
  price,
  coins,
  label,
  owned,
  state,
  buy,
}: {
  card: CardFace;
  serial?: number;
  price: number;
  coins: number;
  label?: string;
  owned: boolean;
  state?: "bought" | "sold-out";
  buy: () => ReturnType<typeof buyOffer>;
}) {
  const { pending, result, run } = useEconomy();
  const short = price - coins;
  return (
    <li className="relative flex flex-col gap-2.5">
      {(label || !owned) && (
        <span
          className={`absolute -top-2 -right-2 z-10 rounded-full px-2 py-0.5 text-xs font-bold ${
            label ? "bg-accent text-accent-ink shadow-[0_2px_0_var(--accent-edge)]" : "bg-accent text-accent-ink"
          }`}
        >
          {label ?? "Il te manque"}
        </span>
      )}
      <Link href={`/cartes/${card.slug}`} className="block">
        <TradingCard card={card} serial={serial} className="w-full" />
      </Link>
      <div className="flex items-center justify-between gap-2">
        <Coins amount={price} className="font-bold" />
        {state === "bought" ? (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-muted">
            <Check className="size-4" aria-hidden />
            Achetée
          </span>
        ) : state === "sold-out" ? (
          <span className="text-sm font-semibold text-muted">Épuisée</span>
        ) : (
          <button
            type="button"
            disabled={pending || short > 0}
            onClick={() => run(buy)}
            aria-label={`Acheter ${card.name} pour ${int.format(price)} jetons`}
            className={`${buttonPrimary} px-4 py-2`}
          >
            {pending ? "Achat…" : "Acheter"}
          </button>
        )}
      </div>
      {short > 0 && !state && <p className="text-xs text-muted">Encore {int.format(short)} jetons.</p>}
      <Feedback result={result} />
    </li>
  );
}

const grid = "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4";

function Section({
  id,
  title,
  detail,
  children,
}: {
  id?: string;
  title: string;
  detail?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="title-drop font-display text-xl sm:text-2xl">{title}</h2>
      {detail && <p className="mt-1 max-w-2xl text-sm text-muted">{detail}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/* ---------- Window ---------- */

function ShopWindow({ offers, owned, coins }: { offers: Offer[]; owned: Set<string>; coins: number }) {
  if (offers.length === 0) {
    return <EmptyState title="La vitrine est vide.">Toutes les voitures proposables sont sorties.</EmptyState>;
  }
  return (
    <ul className={grid}>
      {[...offers]
        .sort((a, b) => Number(b.weekly) - Number(a.weekly))
        .map((offer) => (
          <ForSale
            key={`${offer.period}-${offer.slot}`}
            card={offer.card}
            price={offer.price}
            coins={coins}
            owned={owned.has(offer.card.slug)}
            label={offer.weekly ? "Pièce de la semaine" : undefined}
            state={offer.bought ? "bought" : offer.soldOut ? "sold-out" : undefined}
            buy={() => buyOffer(offer.period, offer.slot)}
          />
        ))}
    </ul>
  );
}

/* ---------- Premium packs ---------- */

function PackStrip({ coins }: { coins: number }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {PACKS.filter((pack) => !pack.free).map((pack) => {
        const short = pack.price - coins;
        return (
          <li key={pack.id}>
            <Link
              href={`/boosters?pack=${pack.id}`}
              className="group panel flex h-full items-center gap-4 p-4 transition-[transform,filter] duration-200 hover:-translate-y-0.5 hover:brightness-110"
              style={{
                background: `radial-gradient(circle at 14% 50%, ${pack.accent}45, transparent 55%), linear-gradient(180deg, var(--surface-hi), var(--surface) 38%)`,
              }}
            >
              <span className="relative block aspect-[528/938] w-20 shrink-0 -rotate-3 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:-translate-y-1 group-hover:rotate-0 sm:w-[5.5rem]">
                <Image
                  src={pack.image}
                  alt=""
                  fill
                  sizes="88px"
                  className="object-contain drop-shadow-[0_10px_10px_rgb(6_3_30/0.55)]"
                />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-2 self-stretch">
                <span className="title-drop font-display text-lg leading-tight">{pack.name}</span>
                <span className="text-pretty text-sm text-muted">{pack.tagline}</span>
                <span className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                  <span className="inline-flex items-center rounded-full bg-accent px-2.5 py-1 text-sm font-black text-accent-ink shadow-[0_2px_0_var(--accent-edge)]">
                    <Coins amount={pack.price} />
                  </span>
                  <span className="rounded-full bg-bg-deep px-2.5 py-1 text-xs font-black">{packSize(pack)} cartes</span>
                  {short > 0 && <span className="text-xs font-bold text-muted">encore {int.format(short)}</span>}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Second-hand ---------- */

type Filter = "all" | "missing" | CardTier;

function UsedStock({ stock, owned, coins }: { stock: Copy[]; owned: Set<string>; coins: number }) {
  const [filter, setFilter] = useState<Filter>("all");
  const filters: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "Toutes", count: stock.length },
    { id: "missing", label: "Il me manque", count: stock.filter((c) => !owned.has(c.card.slug)).length },
    ...[...TIER_ORDER].reverse().map((tier) => ({
      id: tier as Filter,
      label: TIERS[tier].label,
      count: stock.filter((c) => c.card.tier === tier).length,
    })),
  ];
  const shown = useMemo(
    () =>
      stock
        .filter((c) =>
          filter === "all" ? true : filter === "missing" ? !owned.has(c.card.slug) : c.card.tier === filter,
        )
        .sort(
          (a, b) =>
            Number(owned.has(a.card.slug)) - Number(owned.has(b.card.slug)) ||
            TIER_ORDER.indexOf(b.card.tier) - TIER_ORDER.indexOf(a.card.tier),
        ),
    [stock, owned, filter],
  );

  if (stock.length === 0) {
    return (
      <EmptyState title="Aucune occasion pour l'instant.">
        Quand un joueur revend un double, il arrive ici, moins cher qu&apos;en vitrine.
      </EmptyState>
    );
  }

  return (
    <>
      <div role="group" aria-label="Filtrer les occasions" className="mb-6 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            disabled={f.count === 0}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors disabled:opacity-40 ${
              filter === f.id ? "bg-accent text-accent-ink shadow-[0_2px_0_var(--accent-edge)]" : "bg-surface-lo hover:bg-surface-hi"
            }`}
          >
            {f.label} <span className="tabular-nums opacity-70">{f.count}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState title="Rien dans ce filtre." />
      ) : (
        <ul className={grid}>
          {shown.map((copy) => (
            <ForSale
              key={copy.id}
              card={copy.card}
              serial={copy.serial}
              price={USED_PRICE[copy.card.tier]}
              coins={coins}
              owned={owned.has(copy.card.slug)}
              buy={() => buyUsed(copy.id)}
            />
          ))}
        </ul>
      )}
    </>
  );
}

/* ---------- Player market ---------- */

function Market({
  listings,
  mine,
  owned,
  coins,
  wallet,
}: {
  listings: Listing[];
  mine: Listing[];
  owned: Set<string>;
  coins: number;
  wallet: Wallet;
}) {
  const [onlyMissing, setOnlyMissing] = useState(false);
  const shown = listings.filter((l) => !onlyMissing || !owned.has(l.card.slug));
  return (
    <div className="flex flex-col gap-8">
      {mine.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-extrabold">
            Tes annonces <span className="text-muted tabular-nums">· {mine.length} / {MAX_LISTINGS}</span>
          </h3>
          <ul className="divide-y divide-line panel">
            {mine.map((l) => (
              <li key={l.id} className="flex items-center">
                <Link href={`/cartes/${l.card.slug}`} className="relative ml-4 block aspect-[4/3] w-12 shrink-0 overflow-hidden rounded-md bg-surface-lo">
                  <Image src={l.card.image} alt={l.card.name} fill sizes="48px" className="object-cover" />
                </Link>
                <ul className="min-w-0 flex-1">
                  <ListingRow listing={l} title={l.card.name} supply={l.card.supply} mine wallet={wallet} />
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}

      {listings.length === 0 ? (
        <EmptyState title="Personne ne vend pour l'instant.">
          Sur la fiche d&apos;une de tes voitures, fixe ton prix et mets-la en vente : la première vente fixera sa cote.
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {[false, true].map((missing) => (
              <button
                key={String(missing)}
                type="button"
                aria-pressed={onlyMissing === missing}
                onClick={() => setOnlyMissing(missing)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  onlyMissing === missing ? "bg-accent text-accent-ink shadow-[0_2px_0_var(--accent-edge)]" : "bg-surface-lo hover:bg-surface-hi"
                }`}
              >
                {missing ? "Il me manque" : "Toutes"}{" "}
                <span className="tabular-nums opacity-70">
                  {missing ? listings.filter((l) => !owned.has(l.card.slug)).length : listings.length}
                </span>
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <EmptyState title="Rien dans ce filtre." />
          ) : (
            <ul className={grid}>
              {shown.map((l) => (
                <ForSale
                  key={l.id}
                  card={l.card}
                  serial={l.serial}
                  price={l.price}
                  coins={coins}
                  owned={owned.has(l.card.slug)}
                  label={l.seller ? `De ${l.seller.name}` : undefined}
                  buy={() => buyListing(l.id)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- Selling duplicates ---------- */

function SellCopy({ copy }: { copy: Copy }) {
  const { pending, result, run } = useEconomy();
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="relative block aspect-[4/3] w-12 shrink-0 overflow-hidden rounded-md bg-surface-lo">
        <Image src={copy.card.image} alt="" fill sizes="48px" className="object-cover" />
      </span>
      <span className="min-w-0 flex-1">
        <Link href={`/cartes/${copy.card.slug}`} className="block truncate text-sm font-semibold hover:underline">
          {copy.card.name}
        </Link>
        <span className="block text-xs text-muted tabular-nums">
          Nº {int.format(copy.serial)}
          {result && <span className={result.ok ? "" : "text-danger"}> · {result.text}</span>}
        </span>
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => sellCopy(copy.id))}
        className={`${buttonGhost} shrink-0 px-3 py-1.5`}
      >
        <Coins amount={SELL_PRICE[copy.card.tier]} />
      </button>
    </li>
  );
}

function SellTier({ tier, copies }: { tier: CardTier; copies: Copy[] }) {
  const { pending, result, run } = useEconomy();
  const [confirming, setConfirming] = useState(false);
  const total = copies.length * SELL_PRICE[tier];
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex w-10 shrink-0">
          <RarityDiamonds tier={tier} size={8} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">
            {copies.length} double{copies.length > 1 ? "s" : ""} {TIERS[tier].label.toLowerCase()}
            {copies.length > 1 ? "s" : ""}
          </span>
          <span className="block text-sm text-muted">
            <Coins amount={SELL_PRICE[tier]} /> l&apos;unité
          </span>
        </span>
        {copies.length > 0 &&
          (confirming ? (
            <span className="flex gap-2">
              <button type="button" onClick={() => setConfirming(false)} className={`${buttonGhost} px-4 py-2`}>
                Annuler
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => sellDuplicates(tier), () => setConfirming(false))}
                className={`${buttonPrimary} px-4 py-2`}
              >
                {pending ? "Revente…" : <>Confirmer · +<Coins amount={total} /></>}
              </button>
            </span>
          ) : (
            <button type="button" onClick={() => setConfirming(true)} className={`${buttonGhost} px-4 py-2`}>
              <Recycle className="size-4" aria-hidden />
              Tout revendre
            </button>
          ))}
      </div>
      {result && (
        <div className="mt-2 pl-[3.25rem]">
          <Feedback result={result} />
        </div>
      )}
      {copies.length > 0 && (
        <details className="group mt-2 pl-[3.25rem]">
          <summary className="cursor-pointer list-none text-sm font-semibold text-muted marker:hidden hover:text-ink">
            <span className="group-open:hidden">Choisir une par une</span>
            <span className="hidden group-open:inline">Masquer</span>
          </summary>
          <ul className="mt-2 max-h-80 divide-y divide-line overflow-y-auto">
            {copies.map((copy) => (
              <SellCopy key={copy.id} copy={copy} />
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

function SellPanel({ duplicates }: { duplicates: Record<CardTier, Copy[]> }) {
  const count = TIER_ORDER.reduce((n, tier) => n + duplicates[tier].length, 0);
  if (count === 0) {
    return (
      <EmptyState title="Aucun double à revendre.">
        Tu gardes toujours un exemplaire de chaque voiture ; ceux de ton garage et de tes échanges en cours restent
        aussi.
      </EmptyState>
    );
  }
  return (
    <ul className="divide-y divide-line panel px-5 ">
      {[...TIER_ORDER].reverse().map((tier) =>
        duplicates[tier].length > 0 ? <SellTier key={tier} tier={tier} copies={duplicates[tier]} /> : null,
      )}
    </ul>
  );
}

/* ---------- Page body ---------- */

export function Shop({
  wallet: initialWallet,
  offers,
  stock,
  listings,
  myListings,
  owned: ownedSlugs,
  duplicates,
}: {
  wallet: Wallet;
  offers: Offer[];
  stock: Copy[];
  listings: Listing[];
  myListings: Listing[];
  owned: string[];
  duplicates: Record<CardTier, Copy[]>;
}) {
  const { coins } = useWallet(initialWallet);
  const owned = useMemo(() => new Set(ownedSlugs), [ownedSlugs]);

  return (
    <div className="flex flex-col gap-16">
      <Section
        title="Vitrine du jour"
        detail="Des voitures neuves, les mêmes pour tout le monde. Elle change chaque jour à minuit, la pièce de la semaine chaque lundi. Une seule de chaque par joueur."
      >
        <ShopWindow offers={offers} owned={owned} coins={coins} />
      </Section>

      <Section
        title="Packs premium"
        detail="Ils ne s'ouvrent qu'avec des jetons. Les packs gratuits s'achètent aussi, 200 jetons, quand ton stock est vide."
      >
        <PackStrip coins={coins} />
      </Section>

      <Section
        id="marche"
        title="Marché des joueurs"
        detail={`Des voitures mises en vente par les joueurs, au prix qu'ils ont choisi autour de la cote. ${MARKET_FEE_RATE * 100} % de chaque vente part en frais et sort du jeu. Une annonce dure ${MARKET_DAYS} jours.`}
      >
        <Market
          listings={listings.filter((l) => !myListings.some((m) => m.id === l.id))}
          mine={myListings}
          owned={owned}
          coins={coins}
          wallet={initialWallet}
        />
      </Section>

      <Section
        id="occasions"
        title="Occasions"
        detail="Des exemplaires revendus par les joueurs, numéro d'origine compris. Moins chers qu'en vitrine ; premier arrivé, premier servi."
      >
        <UsedStock stock={stock} owned={owned} coins={coins} />
      </Section>

      <Section
        id="revendre"
        title="Revendre tes doubles"
        detail="La boutique rachète tes doubles et les remet en occasion. Tu gardes toujours un exemplaire de chaque voiture."
      >
        <SellPanel duplicates={duplicates} />
      </Section>
    </div>
  );
}
