"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { TIER_ORDER, TIERS, byRarity, type CardFace, type CardTier } from "@/lib/cards";
import { RarityDiamonds } from "../rarity-diamonds";
import { TradingCard } from "../trading-card";
import { EmptyState, buttonPrimary } from "./ui";

/** All the copies a player holds of one car. */
export type Stack = {
  card: CardFace;
  /** Lowest serial first: the one worth showing. */
  copies: { id: string; serial: number }[];
  lastObtained: string;
};

type Sort = "rarity" | "recent" | "name";

const SORTS: { id: Sort; label: string }[] = [
  { id: "rarity", label: "Rareté" },
  { id: "recent", label: "Récentes" },
  { id: "name", label: "Nom" },
];

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function CollectionGrid({
  stacks,
  catalogueSize,
  cultures,
}: {
  stacks: Stack[];
  catalogueSize: number;
  cultures: string[];
}) {
  const [tier, setTier] = useState<CardTier | "all">("all");
  const [culture, setCulture] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("rarity");
  const [doublesOnly, setDoublesOnly] = useState(false);

  const byTier = Object.fromEntries(
    TIER_ORDER.map((t) => [t, stacks.filter((s) => s.card.tier === t).length]),
  ) as Record<CardTier, number>;
  const doubles = stacks.filter((s) => s.copies.length > 1).length;

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    const list = stacks.filter(
      (s) =>
        (tier === "all" || s.card.tier === tier) &&
        (culture === "all" || s.card.culture === culture) &&
        (!doublesOnly || s.copies.length > 1) &&
        (!q || normalize(`${s.card.name} ${s.card.brand ?? ""}`).includes(q)),
    );
    return list.sort((a, b) =>
      sort === "recent"
        ? b.lastObtained.localeCompare(a.lastObtained)
        : sort === "name"
          ? a.card.name.localeCompare(b.card.name, "fr")
          : byRarity(a.card, b.card) || a.card.name.localeCompare(b.card.name, "fr"),
    );
  }, [stacks, tier, culture, query, sort, doublesOnly]);

  if (stacks.length === 0) {
    return (
      <EmptyState
        title="Ta collection est vide pour l'instant."
        action={
          <Link href="/boosters" className={buttonPrimary}>
            Ouvrir mon premier pack
          </Link>
        }
      >
        Tu as jusqu&apos;à 10 packs gratuits, un de plus toutes les 10 minutes.
      </EmptyState>
    );
  }

  const progress = (stacks.length / catalogueSize) * 100;

  return (
    <div>
      <div className="mb-8 panel p-5 ">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="font-semibold">
            <span className="title-drop font-display text-2xl tabular-nums">{stacks.length}</span>{" "}
            voitures sur <span className="tabular-nums">{catalogueSize.toLocaleString("fr-FR")}</span>
          </p>
          <p className="text-sm text-muted tabular-nums">
            {stacks.reduce((n, s) => n + s.copies.length, 0)} exemplaires ·{" "}
            {doubles} en double
          </p>
        </div>
        <div className="gauge mt-3">
          <span style={{ width: `${progress}%` }} />
        </div>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {TIER_ORDER.map((t) => (
            <li key={t} className="flex items-center gap-2">
              <RarityDiamonds tier={t} size={8} />
              <span className="text-muted">{TIERS[t].label}</span>
              <span className="font-semibold tabular-nums">{byTier[t]}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Rechercher une voiture</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un modèle ou une marque"
            className="field pl-10"
          />
        </label>
        <div className="flex gap-2">
          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="sr-only sm:not-sr-only">Culture</span>
            <select
              value={culture}
              onChange={(event) => setCulture(event.target.value)}
              className="field w-auto py-2 pr-8 text-sm"
            >
              <option value="all">Toutes les cultures</option>
              {cultures.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <span className="sr-only sm:not-sr-only">Trier</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as Sort)}
              className="field w-auto py-2 pr-8 text-sm"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-2">
        <FilterChip active={tier === "all"} onClick={() => setTier("all")}>
          Toutes
        </FilterChip>
        {TIER_ORDER.map((t) => (
          <FilterChip key={t} active={tier === t} onClick={() => setTier(t)}>
            <RarityDiamonds tier={t} size={8} />
            {TIERS[t].label}
          </FilterChip>
        ))}
        <span className="mx-1 hidden h-6 w-px bg-white/15 sm:block" aria-hidden />
        <FilterChip active={doublesOnly} onClick={() => setDoublesOnly((v) => !v)}>
          Doubles à échanger
          <span className="tabular-nums opacity-70">{doubles}</span>
        </FilterChip>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border-2 border-dashed border-white/20 px-6 py-12 text-center text-muted">
          Aucune carte de ta collection ne correspond.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {visible.map(({ card, copies }) => (
            <li key={card.slug} className="relative">
              <Link href={`/cartes/${card.slug}`} className="block">
                <TradingCard card={card} serial={copies[0].serial} className="w-full" />
              </Link>
              {copies.length > 1 && (
                <span className="absolute -top-2 -right-2 z-10 rounded-full bg-accent px-2 py-0.5 text-xs font-black text-accent-ink shadow-[0_2px_0_var(--accent-edge)] tabular-nums">
                  ×{copies.length}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-extrabold transition-colors ${
        active ? "bg-accent text-accent-ink shadow-[0_2px_0_var(--accent-edge)]" : "bg-surface-lo text-ink hover:bg-surface-hi"
      }`}
    >
      {children}
    </button>
  );
}
