"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { CalendarClock, ChevronDown, Clock, Gift } from "lucide-react";
import { openPack } from "@/app/actions/packs";
import { TIERS } from "@/lib/cards";
import {
  MAX_PACKS,
  PACKS,
  REFILL_MINUTES,
  oddsOf,
  packSize,
  type PackDef,
  type Wallet,
  type Weekend,
} from "@/lib/packs";
import { salonCountdown, salonDates, type SalonNow } from "@/lib/salons";
import { setWallet, useCountdown, useWallet } from "@/lib/wallet-store";
import { PackIcon } from "../game-nav";
import { RarityDiamonds } from "../rarity-diamonds";
import { Coins } from "./coins";
import { useWebGL } from "./fx/webgl";
import { PackOpening } from "./pack-opening";

const PackShowcase = dynamic(() => import("./fx/pack-3d").then((m) => m.PackShowcase), { ssr: false });

const formatCountdown = (ms: number) => {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

function WalletBar({
  available,
  bonus,
  coins,
  remaining,
}: {
  available: number;
  bonus: number;
  coins: number;
  remaining: number | null;
}) {
  const full = available >= MAX_PACKS;
  return (
    <div className="panel flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5 lg:w-[36rem] lg:shrink-0 lg:py-3.5">
      <div className="flex flex-1 flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="flex items-baseline gap-2">
            <span className="title-drop font-display text-3xl tabular-nums">
              {available}
              <span className="text-xl text-muted">/{MAX_PACKS}</span>
            </span>
            <span className="text-sm font-extrabold">packs gratuits</span>
          </p>
          <p
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-extrabold tabular-nums ${
              full ? "bg-green/15 text-green" : "bg-bg-deep text-ink"
            }`}
            aria-live="polite"
            title={`Un pack offert toutes les ${REFILL_MINUTES} minutes, jusqu'à ${MAX_PACKS}.`}
          >
            <Clock className="size-4" aria-hidden />
            {full ? "Stock plein" : remaining === null ? "…" : `+1 dans ${formatCountdown(remaining)}`}
          </p>
        </div>
        <ol className="grid grid-cols-10 gap-1 sm:gap-1.5" aria-label={`${available} packs sur ${MAX_PACKS}`}>
          {Array.from({ length: MAX_PACKS }, (_, i) => (
            <li
              key={i}
              className={`h-3 rounded-full sm:h-3.5 ${
                i < available
                  ? "bg-gradient-to-b from-[#ffe680] to-[#ffbf1f] shadow-[inset_0_-2px_0_rgb(0_0_0/0.15)]"
                  : "bg-bg-deep shadow-[inset_0_2px_3px_rgb(0_0_0/0.5)]"
              }`}
            />
          ))}
        </ol>
        <p className="text-xs font-bold text-muted lg:hidden">
          Un pack offert toutes les {REFILL_MINUTES} minutes, jusqu&apos;à {MAX_PACKS}.
        </p>
      </div>

      <div className="flex gap-2 sm:flex-col sm:items-stretch">
        {bonus > 0 && (
          <p className="panel-sunken flex flex-1 items-center gap-2 px-3 py-2 text-sm font-extrabold" title="Gagnés avec tes séries, utilisés une fois les gratuits épuisés">
            <Gift className="size-4 text-green" aria-hidden />+{bonus} bonus
          </p>
        )}
        <Link
          href="/boutique"
          className="panel-sunken flex flex-1 items-center gap-2 px-3 py-2 text-sm font-extrabold transition-[filter] hover:brightness-125"
        >
          <Coins amount={coins} />
          <span className="font-bold text-muted">jetons</span>
        </Link>
      </div>
    </div>
  );
}

function OddsTable({ pack }: { pack: PackDef }) {
  return (
    <details className="panel group relative">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 font-extrabold marker:hidden">
        <span>
          Taux d&apos;obtention <span className="text-muted">· {pack.name}</span>
        </span>
        <ChevronDown className="size-5 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="grid gap-6 px-5 pb-5 sm:grid-cols-2 lg:absolute lg:rounded-[1.25rem] lg:bg-[var(--surface)] lg:shadow-[var(--shadow-panel)] lg:bottom-[calc(100%+0.5rem)] lg:left-0 lg:z-30 lg:w-[34rem] lg:pt-5">
        {oddsOf(pack).map((block) => (
          <div key={block.label} className="panel-sunken p-4">
            <p className="mb-3 text-xs font-black uppercase tracking-wider text-muted">{block.label}</p>
            <ul className="space-y-2">
              {block.rows.map(([tier, pct]) => (
                <li key={tier} className="flex items-center gap-3 text-sm font-bold">
                  <span className="flex w-12">
                    <RarityDiamonds tier={tier} size={9} />
                  </span>
                  <span className="flex-1">{TIERS[tier].label}</span>
                  <span className="font-black tabular-nums">{pct} %</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-xs text-muted sm:col-span-2">
          Dans un pack à thème, chaque carte a 8 chances sur 10 de venir de son
          thème, sans changer sa rareté. Une voiture dont tous les exemplaires
          réels sont déjà sortis ne peut plus être tirée : sa case passe à la
          rareté du dessous.
        </p>
      </div>
    </details>
  );
}

function PackOption({
  pack,
  active,
  onSelect,
  fluid = false,
}: {
  pack: PackDef;
  active: boolean;
  onSelect: () => void;
  fluid?: boolean;
}) {
  const weekend = pack.rotation !== undefined;
  const badge = pack.salon ? "Salon" : weekend ? "Week-end" : null;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={`${pack.name}, ${pack.salon ? "cette semaine, " : weekend ? "ce week-end, " : ""}${pack.free ? "gratuit" : `${pack.price} jetons`}`}
      onClick={onSelect}
      className={`group flex shrink-0 snap-center flex-col items-center gap-2 rounded-2xl pt-2 pb-1 ${fluid ? "w-full" : "w-[5.5rem] sm:w-24"}`}
    >
      <span
        className={`relative block aspect-[528/938] w-full transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          active ? "-translate-y-1.5 scale-105" : "group-hover:-translate-y-1 group-hover:-rotate-2"
        }`}
        style={{ filter: active ? `drop-shadow(0 0 14px ${pack.accent}aa) drop-shadow(0 10px 12px rgb(6 3 30 / 0.6))` : "drop-shadow(0 8px 10px rgb(6 3 30 / 0.55))" }}
      >
        <Image src={pack.image} alt="" fill sizes="96px" className="object-contain" />
        {badge && (
          <span
            aria-hidden
            className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-wider whitespace-nowrap text-white shadow-[0_2px_0_rgb(0_0_0/0.35)]"
            style={{ background: pack.accent }}
          >
            {badge}
          </span>
        )}
      </span>
      <span
        className={`flex h-6 items-center rounded-full px-2 text-xs font-black tabular-nums ${
          active ? "bg-accent text-accent-ink" : pack.free ? "bg-white/10 text-ink" : "bg-bg-deep text-ink"
        }`}
      >
        {pack.free ? "Gratuit" : <Coins amount={pack.price} />}
      </span>
    </button>
  );
}

function PackPicker({
  packs,
  selected,
  onSelect,
  layout,
}: {
  packs: PackDef[];
  selected: string;
  onSelect: (id: string) => void;
  layout: "strip" | "grid";
}) {
  if (layout === "grid") {
    return (
      <div role="radiogroup" aria-label="Choisis un pack" className="flex items-end justify-center gap-2 xl:gap-3">
        {packs.map((pack) => (
          <div key={pack.id} className="min-w-0 max-w-[4.75rem] flex-1">
            <PackOption pack={pack} fluid active={pack.id === selected} onSelect={() => onSelect(pack.id)} />
          </div>
        ))}
      </div>
    );
  }
  return <PackStrip packs={packs} selected={selected} onSelect={onSelect} />;
}

/** Phones and tablets: one swipeable row that keeps the picked pack in view. */
function PackStrip({
  packs,
  selected,
  onSelect,
}: {
  packs: PackDef[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const placed = useRef(false);
  useEffect(() => {
    const box = strip.current;
    const item = box?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!box || !item) return;
    // Horizontal only: never scroll the page to reach the strip.
    const target = item.offsetLeft - (box.clientWidth - item.offsetWidth) / 2;
    box.scrollTo({ left: Math.max(0, target), behavior: placed.current ? "smooth" : "instant" });
    placed.current = true;
  }, [selected]);
  return (
    <div ref={strip} role="radiogroup" aria-label="Choisis un pack" className="relative -mx-5 overflow-x-auto px-5 pt-4 pb-2 [scrollbar-width:none] sm:-mx-6 sm:px-6">
      <div className="flex w-max snap-x snap-mandatory items-end gap-2 sm:gap-3">
        {packs.map((pack, i) => (
          <div key={pack.id} className="flex items-end">
            {i > 0 && pack.free !== packs[i - 1].free && (
              <span aria-hidden className="mx-2 mb-12 h-24 w-px bg-white/15" />
            )}
            <PackOption pack={pack} active={pack.id === selected} onSelect={() => onSelect(pack.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** How the selected pack opens now: a free pack, jetons, or not at all. */
function payment(pack: PackDef, free: number, coins: number) {
  if (pack.free && free > 0) return { pay: false, can: true };
  return { pay: true, can: coins >= pack.price };
}

/** On sale now: the free packs, this week's show pack and this weekend's pack if any, then premium packs. */
function packsOn(weekend: Weekend, salon: SalonNow) {
  return [
    ...PACKS.filter((p) => p.free),
    ...(salon.live ? [salon.edition.salon.pack] : []),
    ...(weekend.live ? [weekend.pack] : []),
    ...PACKS.filter((p) => !p.free),
  ];
}

/** The show on this week, or the next one when it opens within two weeks. */
function SalonTeaser({ salon }: { salon: SalonNow }) {
  if (!salon.live && salon.days > 14) return null;
  const { salon: show } = salon.edition;
  return (
    <p className="-mt-2 flex items-center justify-center gap-2 text-center text-sm text-muted sm:-mt-4">
      <CalendarClock className="size-4 shrink-0" aria-hidden />
      <span>
        {salon.live ? (
          <>
            <strong className="font-extrabold text-ink">{show.name}</strong> jusqu&apos;à dimanche : son pack et trois{" "}
          </>
        ) : (
          <>
            {salonCountdown(salon.days)}, <strong className="font-extrabold text-ink">{show.name}</strong>{" "}
            {salonDates(salon.edition)} : un pack et trois{" "}
          </>
        )}
        <Link href="/succes#salons" className="font-extrabold text-accent underline-offset-4 hover:underline">
          défis
        </Link>
        .
      </span>
    </p>
  );
}

/** Monday to Thursday: which pack comes on Friday. */
function WeekendTeaser({ weekend }: { weekend: Weekend }) {
  if (weekend.live) return null;
  return (
    <p className="-mt-2 flex items-center justify-center gap-2 text-center text-sm text-muted sm:-mt-4">
      <CalendarClock className="size-4 shrink-0" aria-hidden />
      <span>
        {weekend.days === 1 ? "Demain" : `Dans ${weekend.days} jours`}, le pack du week-end{" "}
        <strong className="font-extrabold text-ink">{weekend.pack.name}</strong>, du vendredi au dimanche seulement.
      </span>
    </p>
  );
}

export function PackShop({
  initialWallet,
  initialPack,
  weekend,
  salon,
}: {
  initialWallet: Wallet;
  initialPack?: string;
  weekend: Weekend;
  salon: SalonNow;
}) {
  const wallet = useWallet(initialWallet);
  const remaining = useCountdown(wallet.deadline);
  const packs = packsOn(weekend, salon);
  const [selected, setSelected] = useState(
    packs.some((p) => p.id === initialPack)
      ? initialPack!
      : salon.live
        ? salon.edition.salon.pack.id
        : weekend.live
          ? weekend.pack.id
          : packs[0].id,
  );
  const [opening, setOpening] = useState<{ pack: PackDef; pay: boolean } | null>(null);
  const pack = packs.find((p) => p.id === selected) ?? packs[0];
  const reduce = useReducedMotion() ?? false;
  const fancy = useWebGL() && !reduce;
  const how = payment(pack, wallet.total, wallet.coins);

  if (opening) {
    const again = payment(opening.pack, wallet.total, wallet.coins);
    return (
      <PackOpening
        pack={opening.pack}
        onWallet={setWallet}
        canOpenAnother={again.can}
        draw={(id) => openPack(id, opening.pay)}
        onExit={() => setOpening(null)}
      />
    );
  }

  const openButton = (
    <button
      type="button"
      disabled={!how.can}
      onClick={() => setOpening({ pack, pay: how.pay })}
      className="btn btn-gold btn-lg w-full"
    >
      {!how.pay ? (
        <>
          <PackIcon className="size-6" />
          Ouvrir · {pack.name}
        </>
      ) : (
        <>
          {how.can ? "Acheter et ouvrir" : "Pas assez de jetons"} · <Coins amount={pack.price} />
        </>
      )}
    </button>
  );

  return (
    <div className="flex flex-col gap-6 pb-20 sm:gap-8 lg:h-full lg:gap-5 lg:pb-0">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <div>
          <h1 className="title-drop font-display text-[2rem] leading-[1.05] sm:text-[2.75rem]">Boosters</h1>
          <p className="mt-2 max-w-xl text-pretty text-muted">
            Choisis un pack, déchire-le, révèle tes cartes une à une : la plus rare arrive en dernier.
          </p>
        </div>
        <WalletBar
          available={wallet.available}
          bonus={wallet.bonus}
          coins={wallet.coins}
          remaining={wallet.ready ? remaining : null}
        />
      </div>

      <div className="flex flex-col gap-6 lg:hidden">
        <PackPicker packs={packs} selected={pack.id} onSelect={setSelected} layout="strip" />
        <SalonTeaser salon={salon} />
        <WeekendTeaser weekend={weekend} />
      </div>

      <div className="grid items-start gap-2 lg:min-h-0 lg:flex-1 lg:grid-cols-2 lg:grid-rows-1 lg:items-stretch lg:gap-10">
        <div className="relative h-[clamp(15rem,40dvh,26rem)] lg:h-auto lg:min-h-0">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 transition-[background] duration-500"
            style={{ background: `radial-gradient(closest-side, ${pack.accent}55, transparent 75%)` }}
          />
          {fancy ? (
            <PackShowcase pack={pack} />
          ) : (
            <span className="pack-bob absolute inset-y-4 left-1/2 aspect-[528/938] -translate-x-1/2 drop-shadow-[0_24px_24px_rgb(6_3_30/0.6)]">
              <Image src={pack.image} alt="" fill sizes="300px" className="object-contain" priority />
            </span>
          )}
        </div>

        <div className="flex flex-col items-center gap-5 text-center lg:items-start lg:justify-center lg:gap-4 lg:text-left">
          <div>
            <h2 className="title-drop font-display text-4xl sm:text-5xl lg:text-[2.75rem]">{pack.name}</h2>
            <p className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs font-black lg:justify-start">
              <span className="inline-flex items-center gap-2 rounded-full bg-bg-deep px-3 py-1.5">
                <span className="size-2 rounded-full" style={{ background: pack.accent }} />
                {pack.salon ? "Pack du salon" : pack.rotation !== undefined ? "Pack du week-end" : pack.free ? "Pack gratuit" : "Pack premium"}
              </span>
              <span className="rounded-full bg-bg-deep px-3 py-1.5">{packSize(pack)} cartes</span>
            </p>
            <p className="mt-3 max-w-sm text-pretty text-muted">{pack.tagline}</p>
          </div>
          <div className="flex w-full max-w-sm flex-col gap-3">
            <div className="hidden lg:block">{openButton}</div>
            {how.pay && !how.can && (
              <p className="text-sm text-muted">
                Il te manque {new Intl.NumberFormat("fr-FR").format(pack.price - wallet.coins)} jetons.{" "}
                <Link href="/succes" className="font-extrabold text-accent underline-offset-4 hover:underline">
                  Gagne-en avec tes succès
                </Link>
                .
              </p>
            )}
            {pack.free && wallet.total === 0 && remaining !== null && (
              <p className="text-sm font-bold text-muted tabular-nums">
                Prochain pack gratuit dans {formatCountdown(remaining)}.
              </p>
            )}
          </div>
          <div className="hidden w-full max-w-sm flex-col gap-3 lg:flex [&>p]:mt-0 [&>p]:justify-start [&>p]:text-left">
            <SalonTeaser salon={salon} />
            <WeekendTeaser weekend={weekend} />
            <OddsTable pack={pack} />
          </div>
        </div>
      </div>

      <div className="hidden lg:block">
        <PackPicker packs={packs} selected={pack.id} onSelect={setSelected} layout="grid" />
      </div>

      <div className="lg:hidden">
        <OddsTable pack={pack} />
      </div>

      {/* Phones and tablets: the action stays in reach above the tab bar, whatever pack is picked. */}
      <div className="fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 bg-gradient-to-t from-bg-deep/90 to-transparent px-4 pt-6 pb-2 lg:hidden">
        <div className="mx-auto max-w-md">{openButton}</div>
      </div>
    </div>
  );
}
