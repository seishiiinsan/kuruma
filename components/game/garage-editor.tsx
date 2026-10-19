"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Plus, Search, X } from "lucide-react";
import { saveGarage } from "@/app/actions/garage";
import type { Copy } from "@/lib/game";
import { TradingCard } from "../trading-card";
import type { Stack } from "./collection-grid";
import { buttonPrimary } from "./ui";

const SLOTS = 6;

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The player's own garage: add from the collection, reorder, remove. Saves on every change. */
export function GarageEditor({ garage, stacks }: { garage: Copy[]; stacks: Stack[] }) {
  const [slots, setSlots] = useState(garage);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const picker = useRef<HTMLDialogElement>(null);

  function commit(next: Copy[]) {
    const previous = slots;
    setSlots(next);
    setError(null);
    start(async () => {
      const result = await saveGarage(next.map((copy) => copy.id));
      if (!result.ok) {
        setSlots(previous);
        setError(result.error);
      }
    });
  }

  const move = (index: number, by: -1 | 1) => {
    const next = [...slots];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    commit(next);
  };

  if (stacks.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-white/20 px-6 py-14 text-center">
        <p className="font-semibold">Ton garage attend ses premières voitures.</p>
        <p className="max-w-sm text-sm text-muted">Ouvre des packs, puis choisis ici les cartes à exposer.</p>
        <Link href="/boosters" className={`${buttonPrimary} mt-2`}>
          Ouvrir un pack
        </Link>
      </div>
    );
  }

  return (
    <div className="panel p-6 sm:p-10" aria-busy={pending}>
      <ul className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
        {slots.map((copy, index) => (
          <li key={copy.id} className="group relative">
            <Link href={`/cartes/${copy.card.slug}`} className="block">
              <TradingCard card={copy.card} serial={copy.serial} finish={copy.finish} className="w-full" />
            </Link>
            <button
              type="button"
              onClick={() => commit(slots.filter((c) => c.id !== copy.id))}
              aria-label={`Retirer ${copy.card.name} du garage`}
              className="absolute -top-2 -right-2 z-10 flex size-7 items-center justify-center rounded-full bg-danger text-white shadow-[0_2px_0_var(--danger-edge)] transition-[filter] hover:brightness-110"
            >
              <X className="size-4" aria-hidden />
            </button>
            <div className="mt-2 flex justify-center gap-1">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Déplacer ${copy.card.name} vers la gauche`}
                className="flex size-8 items-center justify-center rounded-full bg-surface-lo text-muted transition-colors hover:bg-surface-hi hover:text-ink disabled:invisible"
              >
                <ArrowLeft className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === slots.length - 1}
                aria-label={`Déplacer ${copy.card.name} vers la droite`}
                className="flex size-8 items-center justify-center rounded-full bg-surface-lo text-muted transition-colors hover:bg-surface-hi hover:text-ink disabled:invisible"
              >
                <ArrowRight className="size-3.5" aria-hidden />
              </button>
            </div>
          </li>
        ))}
        {Array.from({ length: SLOTS - slots.length }, (_, i) => (
          <li key={`empty-${i}`}>
            <button
              type="button"
              onClick={() => picker.current?.showModal()}
              className="flex aspect-[5/7] w-full flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-white/20 text-sm font-semibold text-muted transition-colors hover:border-ink/30 hover:text-ink"
            >
              <Plus className="size-5" aria-hidden />
              Ajouter
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-4 text-sm font-bold text-danger">
          {error}
        </p>
      )}

      <GaragePicker
        ref={picker}
        stacks={stacks}
        taken={new Set(slots.map((c) => c.card.slug))}
        onPick={(copy) => {
          picker.current?.close();
          commit([...slots, copy]);
        }}
      />
    </div>
  );
}

function GaragePicker({
  ref,
  stacks,
  taken,
  onPick,
}: {
  ref: React.Ref<HTMLDialogElement>;
  stacks: Stack[];
  taken: Set<string>;
  onPick: (copy: Copy) => void;
}) {
  const [query, setQuery] = useState("");
  const options = useMemo(() => {
    const q = normalize(query.trim());
    return stacks.filter(
      (s) => !taken.has(s.card.slug) && (!q || normalize(`${s.card.name} ${s.card.brand ?? ""}`).includes(q)),
    );
  }, [stacks, taken, query]);

  return (
    <dialog
      ref={ref}
      aria-label="Choisir une carte à exposer"
      className="m-auto max-h-[85vh] w-[min(56rem,calc(100vw-2rem))] overflow-hidden rounded-3xl bg-bg p-0 text-ink shadow-[var(--shadow-lift)] ring-1 ring-white/10 backdrop:bg-bg-deep/70 backdrop:backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close();
      }}
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="flex items-center gap-3 border-b border-white/10 bg-surface p-4">
          <label className="relative flex-1">
            <span className="sr-only">Rechercher dans ta collection</span>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher dans ta collection"
              className="field pl-10"
            />
          </label>
          <form method="dialog">
            <button
              type="submit"
              aria-label="Fermer"
              className="btn size-11 p-0"
            >
              <X className="size-5" aria-hidden />
            </button>
          </form>
        </div>
        <div className="overflow-y-auto p-5">
          {options.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">Aucune carte à ajouter.</p>
          ) : (
            <ul className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-4 md:grid-cols-6">
              {options.map(({ card, copies }) => (
                <li key={card.slug}>
                  <button
                    type="button"
                    onClick={() =>
                      onPick({
                        // The best (lowest) serial goes on show.
                        ...copies[0],
                        obtainedAt: "",
                        card,
                      })
                    }
                    className="block w-full rounded-[14px] transition-transform hover:-translate-y-1"
                  >
                    <TradingCard card={card} serial={copies[0].serial} finish={copies[0].finish} interactive={false} className="w-full" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </dialog>
  );
}
