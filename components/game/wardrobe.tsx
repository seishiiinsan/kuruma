"use client";

import { useState, useTransition } from "react";
import { Check, Lock, Sparkles } from "lucide-react";
import { buyCosmetic, equipLook } from "@/app/actions/cosmetics";
import { TIERS } from "@/lib/cards";
import { COSMETICS, KINDS, MAX_BADGES, isBought, type Cosmetic, type CosmeticKind, type Look } from "@/lib/cosmetics";
import { ACHIEVEMENTS, goalText, type Metrics } from "@/lib/economy";
import type { PlayerRef } from "@/lib/game";
import type { Wallet } from "@/lib/packs";
import { useWallet } from "@/lib/wallet-store";
import { BadgeChip, BadgeRow, FramedAvatar, PlayerTitle, bannerPaint } from "../cosmetics";
import { Coins } from "./coins";
import { Tabs } from "./tabs";
import { buttonGhost, buttonPrimary } from "./ui";
import { useEconomy } from "./use-economy";

const int = new Intl.NumberFormat("fr-FR");

type OwnedMap = Record<string, { fresh: boolean }>;

const SLOT: Record<Exclude<CosmeticKind, "badge">, keyof Look> = {
  title: "titleId",
  frame: "frameId",
  banner: "bannerId",
};

const sameLook = (a: Look, b: Look) =>
  a.titleId === b.titleId &&
  a.frameId === b.frameId &&
  a.bannerId === b.bannerId &&
  a.badgeIds.join() === b.badgeIds.join();

const isWorn = (look: Look, c: Cosmetic) =>
  c.kind === "badge" ? look.badgeIds.includes(c.id) : look[SLOT[c.kind]] === c.id;

function toggle(look: Look, c: Cosmetic): Look {
  if (c.kind === "badge") {
    return {
      ...look,
      badgeIds: look.badgeIds.includes(c.id) ? look.badgeIds.filter((id) => id !== c.id) : [...look.badgeIds, c.id],
    };
  }
  const slot = SLOT[c.kind];
  return { ...look, [slot]: look[slot] === c.id ? null : c.id };
}

/* ---------- Preview ---------- */

function Preview({ player, look }: { player: PlayerRef; look: Look }) {
  const paint = bannerPaint(look);
  return (
    <div
      className="relative overflow-hidden rounded-[1.25rem] p-5 shadow-[var(--shadow-panel)] sm:p-6"
      style={{ background: paint ?? "linear-gradient(180deg, var(--surface-hi), var(--surface) 60%)" }}
    >
      {paint && <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-bg-deep/70 to-transparent" />}
      <div className="relative flex items-center gap-4">
        <FramedAvatar player={player} look={look} size={72} className="ring-4 ring-accent" />
        <div className="min-w-0">
          <p className="title-drop truncate font-display text-xl sm:text-2xl">{player.name}</p>
          <p className="truncate text-sm">
            {look.titleId ? <PlayerTitle look={look} /> : <span className="text-muted">Aucun titre</span>}
          </p>
          <BadgeRow look={look} size={26} className="mt-2" />
        </div>
      </div>
    </div>
  );
}

/* ---------- One item ---------- */

function Visual({ c, player }: { c: Cosmetic; player: PlayerRef }) {
  switch (c.kind) {
    case "title":
      return (
        <span className="flex h-16 items-center justify-center px-2 text-center font-display text-sm leading-tight" style={{ color: TIERS[c.tier].color }}>
          {c.name}
        </span>
      );
    case "badge":
      return (
        <span className="flex h-16 items-center justify-center">
          <BadgeChip badge={c} size={48} />
        </span>
      );
    case "frame":
      return (
        <span className="flex h-16 items-center justify-center">
          <FramedAvatar player={player} look={{ titleId: null, bannerId: null, badgeIds: [], frameId: c.id }} size={56} />
        </span>
      );
    case "banner":
      return <span className="block h-16 rounded-xl shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]" style={{ background: c.paint }} />;
  }
}

function Item({
  c,
  player,
  owned,
  fresh,
  worn,
  full,
  metrics,
  coins,
  onToggle,
}: {
  c: Cosmetic;
  player: PlayerRef;
  owned: boolean;
  fresh: boolean;
  worn: boolean;
  /** Every badge slot is taken: another one can't go on. */
  full: boolean;
  metrics: Metrics;
  coins: number;
  onToggle: () => void;
}) {
  const { pending, result, run } = useEconomy();
  const tier = TIERS[c.tier];

  let action: React.ReactNode = null;
  if (owned) {
    action = (
      <button
        type="button"
        aria-pressed={worn}
        disabled={!worn && full}
        onClick={onToggle}
        className={`${worn ? "btn btn-green" : buttonGhost} w-full px-3 py-2 text-sm`}
      >
        {worn ? (
          <>
            <Check className="size-4" aria-hidden />
            Équipé
          </>
        ) : full ? (
          `${MAX_BADGES} badges max`
        ) : (
          "Équiper"
        )}
      </button>
    );
  } else if (isBought(c)) {
    const short = c.unlock.price - coins;
    action = (
      <>
        <button
          type="button"
          disabled={pending || short > 0}
          onClick={() => run(() => buyCosmetic(c.id))}
          aria-label={`Acheter ${c.name} pour ${int.format(c.unlock.price)} jetons`}
          className={`${buttonPrimary} w-full px-3 py-2 text-sm`}
        >
          {pending ? "Achat…" : <Coins amount={c.unlock.price} />}
        </button>
        {short > 0 && <p className="text-center text-[0.7rem] text-muted">Encore {int.format(short)}</p>}
      </>
    );
  } else if ("metric" in c.unlock) {
    const { metric, goal } = c.unlock;
    const family = ACHIEVEMENTS.find((a) => a.metric === metric);
    const value = Math.min(metrics[metric] ?? 0, goal);
    action = (
      <div className="flex flex-col gap-1.5">
        <p className="flex items-start gap-1.5 text-[0.75rem] leading-snug text-muted">
          <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
          {family ? goalText(family, goal) : `Objectif ${int.format(goal)}`}
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={goal}
          aria-valuenow={value}
          aria-label={`${int.format(value)} sur ${int.format(goal)}`}
          className="h-1.5 overflow-hidden rounded-full bg-bg-deep"
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${(value / goal) * 100}%` }} />
        </div>
        <p className="text-right text-[0.7rem] font-bold text-muted tabular-nums">
          {int.format(value)} / {int.format(goal)}
        </p>
      </div>
    );
  }

  return (
    <li
      className={`relative flex flex-col gap-3 rounded-2xl p-3 transition-colors ${
        worn ? "bg-green/10 ring-2 ring-green" : owned ? "bg-surface-lo" : "bg-bg-deep/60"
      }`}
    >
      {fresh && (
        <span className="absolute -top-2 -right-2 z-10 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-black text-accent-ink shadow-[0_2px_0_var(--accent-edge)]">
          <Sparkles className="size-3" aria-hidden />
          Nouveau
        </span>
      )}
      <div className={owned || isBought(c) ? "" : "opacity-60 grayscale-[0.5]"}>
        <Visual c={c} player={player} />
      </div>
      <div className="min-w-0">
        {c.kind !== "title" && <p className="truncate text-sm font-extrabold">{c.name}</p>}
        <p className="text-[0.7rem] font-black uppercase tracking-wider" style={{ color: tier.color }}>
          {tier.label}
        </p>
      </div>
      <div className="mt-auto">{action}</div>
      {result && !result.ok && (
        <p role="alert" className="text-xs font-bold text-danger">
          {result.text}
        </p>
      )}
    </li>
  );
}

/* ---------- Wardrobe ---------- */

function Group({ title, items, render }: { title: string; items: Cosmetic[]; render: (c: Cosmetic) => React.ReactNode }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="mb-3 text-sm font-extrabold">
        {title} <span className="text-muted tabular-nums">{items.length}</span>
      </h3>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{items.map(render)}</ul>
    </section>
  );
}

export function Wardrobe({
  player,
  look: saved,
  owned,
  metrics,
  wallet: initialWallet,
}: {
  player: PlayerRef;
  look: Look;
  owned: OwnedMap;
  metrics: Metrics;
  wallet: Wallet;
}) {
  const wallet = useWallet(initialWallet);
  const [draft, setDraft] = useState(saved);
  const [base, setBase] = useState(saved);
  const [saving, startSave] = useTransition();
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const dirty = !sameLook(draft, base);
  const ownedCount = COSMETICS.filter((c) => owned[c.id]).length;

  function save() {
    startSave(async () => {
      const outcome = await equipLook(draft);
      if (outcome.ok) {
        setBase(draft);
        setFeedback({ ok: true, text: "Look enregistré. Il s'affiche sur ton profil et au classement." });
      } else setFeedback({ ok: false, text: outcome.error });
    });
  }

  const render = (c: Cosmetic) => (
    <Item
      key={c.id}
      c={c}
      player={player}
      owned={Boolean(owned[c.id])}
      fresh={Boolean(owned[c.id]?.fresh)}
      worn={isWorn(draft, c)}
      full={c.kind === "badge" && draft.badgeIds.length >= MAX_BADGES}
      metrics={metrics}
      coins={wallet.coins}
      onToggle={() => {
        setFeedback(null);
        setDraft((d) => toggle(d, c));
      }}
    />
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="z-20 flex flex-col gap-3 sm:sticky sm:top-20">
        <Preview player={player} look={draft} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={!dirty || saving} onClick={save} className={buttonPrimary}>
            {saving ? "Enregistrement…" : "Enregistrer mon look"}
          </button>
          {dirty && (
            <button type="button" disabled={saving} onClick={() => setDraft(base)} className={buttonGhost}>
              Annuler
            </button>
          )}
          <p className="text-sm text-muted tabular-nums">
            {ownedCount} / {COSMETICS.length} débloqués · <Coins amount={wallet.coins} />
          </p>
          {feedback && (
            <p role={feedback.ok ? "status" : "alert"} className={`w-full text-sm ${feedback.ok ? "text-green" : "font-bold text-danger"}`}>
              {feedback.text}
            </p>
          )}
        </div>
      </div>

      <Tabs
        tabs={KINDS.map(({ kind, plural, hint }) => {
          const items = COSMETICS.filter((c) => c.kind === kind);
          const mine = items.filter((c) => owned[c.id]);
          return {
            label: plural,
            count: mine.length,
            content: (
              <div className="flex flex-col gap-8">
                <p className="-mt-2 text-sm text-muted">{hint}</p>
                <Group title="À toi" items={mine} render={render} />
                <Group title="À débloquer en jouant" items={items.filter((c) => !owned[c.id] && !isBought(c))} render={render} />
                <Group
                  title="En boutique"
                  items={items.filter((c) => !owned[c.id] && isBought(c)).sort((a, b) => price(a) - price(b))}
                  render={render}
                />
              </div>
            ),
          };
        })}
      />
    </div>
  );
}

const price = (c: Cosmetic) => (isBought(c) ? c.unlock.price : 0);
