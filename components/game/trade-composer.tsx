"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Check, Search } from "lucide-react";
import { proposeTrade } from "@/app/actions/trades";
import { byRarity, formatSerial } from "@/lib/cards";
import type { PlayerRef } from "@/lib/game";
import { Avatar } from "../avatar";
import { TradingCard } from "../trading-card";
import type { Stack } from "./collection-grid";
import { buttonPrimary } from "./ui";

const MAX = 5;

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

type Picked = Map<string, { copyId: string; serial: number }>;

function Side({
  title,
  stacks,
  picked,
  onToggle,
  filterLabel,
  filter,
  badge,
}: {
  title: React.ReactNode;
  stacks: Stack[];
  picked: Picked;
  onToggle: (stack: Stack) => void;
  filterLabel: string;
  filter: (stack: Stack) => boolean;
  badge: (stack: Stack) => string | null;
}) {
  const [query, setQuery] = useState("");
  const [filtered, setFiltered] = useState(() => stacks.some(filter));
  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return stacks
      .filter(
        (s) =>
          picked.has(s.card.slug) ||
          ((!filtered || filter(s)) && (!q || normalize(`${s.card.name} ${s.card.brand ?? ""}`).includes(q))),
      )
      .sort((a, b) => byRarity(a.card, b.card) || a.card.name.localeCompare(b.card.name, "fr"));
  }, [stacks, picked, filtered, filter, query]);

  return (
    <section className="min-w-0 panel p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2.5 title-drop font-display text-lg sm:text-xl">
          {title}
        </h2>
        <span className="shrink-0 text-sm text-muted tabular-nums">
          {picked.size} / {MAX}
        </span>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Rechercher</span>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher"
            className="field pl-10"
          />
        </label>
        <button
          type="button"
          aria-pressed={filtered}
          onClick={() => setFiltered((v) => !v)}
          className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
            filtered ? "bg-accent text-accent-ink shadow-[0_2px_0_var(--accent-edge)]" : "ring-1 ring-line hover:bg-white/10"
          }`}
        >
          {filterLabel}
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">Rien à afficher ici.</p>
      ) : (
        <ul className="mt-5 grid max-h-[32rem] grid-cols-3 gap-x-3 gap-y-5 overflow-y-auto p-1 sm:grid-cols-4">
          {visible.map((stack) => {
            const isPicked = picked.has(stack.card.slug);
            const hint = badge(stack);
            return (
              <li key={stack.card.slug} className="relative">
                <button
                  type="button"
                  onClick={() => onToggle(stack)}
                  aria-pressed={isPicked}
                  disabled={!isPicked && picked.size >= MAX}
                  className={`block w-full rounded-[14px] transition disabled:opacity-40 ${
                    isPicked ? "ring-[3px] ring-accent ring-offset-2" : "hover:-translate-y-0.5"
                  }`}
                >
                  <TradingCard
                    card={stack.card}
                    serial={picked.get(stack.card.slug)?.serial ?? stack.copies[0].serial}
                    interactive={false}
                    className="w-full"
                  />
                </button>
                {isPicked ? (
                  <span className="absolute -top-2 -right-2 z-10 flex size-6 items-center justify-center rounded-full bg-accent text-accent-ink">
                    <Check className="size-4" aria-hidden />
                  </span>
                ) : (
                  hint && (
                    <span className="absolute -top-2 -right-2 z-10 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-black text-accent-ink">
                      {hint}
                    </span>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function TradeComposer({
  partner,
  theirs,
  mine,
  wanted,
}: {
  partner: PlayerRef;
  theirs: Stack[];
  mine: Stack[];
  wanted: string | null;
}) {
  const router = useRouter();
  const mineSlugs = useMemo(() => new Set(mine.map((s) => s.card.slug)), [mine]);
  const [take, setTake] = useState<Picked>(() => {
    const stack = theirs.find((s) => s.card.slug === wanted);
    return new Map(stack ? [[stack.card.slug, { copyId: stack.copies[0].id, serial: stack.copies[0].serial }]] : []);
  });
  const [give, setGive] = useState<Picked>(new Map());
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Take their best serial, give your highest: you keep your low numbers.
  const toggle = (set: typeof setTake, pickBest: boolean) => (stack: Stack) =>
    set((prev) => {
      const next = new Map(prev);
      if (next.has(stack.card.slug)) next.delete(stack.card.slug);
      else if (next.size < MAX) {
        const copy = pickBest ? stack.copies[0] : stack.copies[stack.copies.length - 1];
        next.set(stack.card.slug, { copyId: copy.id, serial: copy.serial });
      }
      return next;
    });

  function submit() {
    setError(null);
    start(async () => {
      const result = await proposeTrade(
        partner.id,
        [...give.values()].map((p) => p.copyId),
        [...take.values()].map((p) => p.copyId),
      );
      if (result.ok) router.push("/echanges");
      else setError(result.error);
    });
  }

  const summary = (picked: Picked, stacks: Stack[]) =>
    [...picked.entries()]
      .map(([slug, p]) => {
        const card = stacks.find((s) => s.card.slug === slug)?.card;
        return card ? `${card.name} ${formatSerial(p.serial, card.supply)}` : null;
      })
      .filter(Boolean)
      .join(", ");

  if (theirs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-white/20 px-6 py-14 text-center">
        <Avatar player={partner} size={56} />
        <p className="font-semibold">{partner.name} n&apos;a encore aucune carte.</p>
        <Link href="/echanges/nouveau" className="text-sm font-semibold underline underline-offset-4">
          Choisir un autre joueur
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-28">
      <div className="mb-8 flex items-center gap-4">
        <Avatar player={partner} size={56} />
        <div>
          <h1 className="title-drop font-display text-2xl sm:text-3xl sm:text-3xl">
            Échange avec {partner.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Choisis ce que tu veux de sa collection, puis ce que tu proposes en retour.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Side
          title={
            <>
              <Avatar player={partner} size={24} />
              <span className="truncate">Tu veux</span>
            </>
          }
          stacks={theirs}
          picked={take}
          onToggle={toggle(setTake, true)}
          filterLabel="Qui me manquent"
          filter={(s) => !mineSlugs.has(s.card.slug)}
          badge={(s) => (mineSlugs.has(s.card.slug) ? null : "Manquante")}
        />
        <Side
          title="Tu donnes"
          stacks={mine}
          picked={give}
          onToggle={toggle(setGive, false)}
          filterLabel="Mes doubles"
          filter={(s) => s.copies.length > 1}
          badge={(s) => (s.copies.length > 1 ? `×${s.copies.length}` : null)}
        />
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 border-t border-white/10 bg-bg-deep/95 backdrop-blur-md lg:bottom-0">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:px-6">
          <p className="min-w-0 flex-1 text-sm">
            {take.size === 0 && give.size === 0 ? (
              <span className="text-muted">Sélectionne au moins une carte de chaque côté.</span>
            ) : (
              <>
                <span className="block truncate">
                  <span className="text-muted">Tu reçois :</span> {summary(take, theirs) || "—"}
                </span>
                <span className="block truncate">
                  <span className="text-muted">Tu donnes :</span> {summary(give, mine) || "—"}
                </span>
              </>
            )}
            {error && (
              <span role="alert" className="mt-1 block font-bold text-danger">
                {error}
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={pending || take.size === 0 || give.size === 0}
            className={`${buttonPrimary} shrink-0 px-6 py-3`}
          >
            <ArrowLeftRight className="size-4" aria-hidden />
            {pending ? "Envoi…" : "Envoyer l'offre"}
          </button>
        </div>
      </div>
    </div>
  );
}
