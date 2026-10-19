"use client";

import {
  ArrowLeftRight,
  BookOpen,
  CalendarCheck,
  Check,
  Crown,
  Gem,
  Gift,
  Globe,
  Hash,
  Layers,
  Package,
  Recycle,
  ShoppingBag,
  IdCard,
  Trophy,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { claimAchievements, claimDaily } from "@/app/actions/economy";
import { DAILY_MAX_STREAK, dailyReward, goalText, type FamilyProgress, type Metric } from "@/lib/economy";
import type { Wallet } from "@/lib/packs";
import { useWallet } from "@/lib/wallet-store";
import { CoinIcon, Coins } from "./coins";
import { buttonClaim, buttonPrimary } from "./ui";
import { useEconomy } from "./use-economy";

const int = new Intl.NumberFormat("fr-FR");

const ICONS: Record<Metric, LucideIcon> = {
  cards: Layers,
  epics: Gem,
  legendaries: Crown,
  packs: Package,
  trades: ArrowLeftRight,
  series: BookOpen,
  cultures: Globe,
  serials: Hash,
  score: Trophy,
  days: CalendarCheck,
  garage: Warehouse,
  sold: Recycle,
  bought: ShoppingBag,
  level: IdCard,
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/* ---------- Daily bonus ---------- */

export function DailyBonus({ wallet: initial }: { wallet: Wallet }) {
  const wallet = useWallet(initial);
  const { pending, result, run } = useEconomy();
  // Days already claimed in the streak, and the one to claim now, if any.
  const filled = Math.min(wallet.streak, DAILY_MAX_STREAK);
  const today = wallet.dailyReady ? Math.min(wallet.streak + 1, DAILY_MAX_STREAK) : null;

  return (
    <section className="panel flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 className="title-drop font-display text-lg sm:text-xl">Prime du jour</h2>
        <p className="mt-1 max-w-md text-sm text-muted">
          {dailyReward(1)} jetons, puis 10 de plus chaque jour d&apos;affilée jusqu&apos;à {dailyReward(DAILY_MAX_STREAK)}.
          Un jour manqué et la série repart de zéro.
        </p>
        <ol className="mt-4 grid grid-cols-7 gap-1.5 sm:flex sm:gap-2" aria-label={`Série : ${wallet.streak} jour${wallet.streak > 1 ? "s" : ""}`}>
          {Array.from({ length: DAILY_MAX_STREAK }, (_, i) => {
            const n = i + 1;
            const isToday = n === today;
            const done = n <= filled && !isToday;
            return (
              <li
                key={n}
                className={`flex h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-xl text-[0.7rem] font-black tabular-nums sm:w-14 ${
                  done
                    ? "bg-green/20 text-green"
                    : isToday
                      ? "pulse-ring bg-gradient-to-b from-[#ffe066] to-[#ffbf1f] text-accent-ink shadow-[0_3px_0_var(--accent-edge)]"
                      : "bg-bg-deep text-muted shadow-[inset_0_2px_4px_rgb(0_0_0/0.4)]"
                }`}
              >
                <span className="opacity-80">J{n}</span>
                {done ? <Check className="size-5" strokeWidth={3} aria-label="touchée" /> : <CoinIcon className="size-5" />}
                <span>{dailyReward(n)}</span>
              </li>
            );
          })}
        </ol>
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        {wallet.dailyReady ? (
          <button type="button" disabled={pending} onClick={() => run(claimDaily)} className={`${buttonPrimary} btn-lg`}>
            <Gift className="size-4" aria-hidden />
            {pending ? "…" : <>Toucher <Coins amount={dailyReward(wallet.streak + 1)} /></>}
          </button>
        ) : (
          <p className="inline-flex items-center gap-1.5 text-sm font-extrabold">
            <Check className="size-4 text-green" aria-hidden />
            Touchée. Reviens demain pour {dailyReward(wallet.streak + 1)} jetons.
          </p>
        )}
        {result && (
          <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-muted" : "font-bold text-danger"}`}>
            {result.text}
          </p>
        )}
      </div>
    </section>
  );
}

/* ---------- Claim everything reached ---------- */

export function ClaimAll({ wallet: initial, total }: { wallet: Wallet; total: number }) {
  const { claimable } = useWallet(initial);
  const { pending, result, run } = useEconomy();
  if (claimable === 0 && !result) return null;
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      {claimable > 0 && (
        <button type="button" disabled={pending} onClick={() => run(claimAchievements)} className={buttonClaim}>
          <Gift className="size-4" aria-hidden />
          {pending ? "Réclamation…" : <>Tout réclamer · <Coins amount={total} /></>}
        </button>
      )}
      {result && (
        <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "font-extrabold text-green" : "font-bold text-danger"}`}>
          {result.text}
        </p>
      )}
    </div>
  );
}

/* ---------- One family of tiered achievements ---------- */

export function AchievementCard({ progress }: { progress: FamilyProgress }) {
  const { family, value, claimable, next, claimed } = progress;
  const Icon = ICONS[family.metric];
  const steps = family.steps.length;
  const reached = family.steps.filter(([goal]) => value >= goal).length;
  const pct = next ? Math.min(100, ((value - next.from) / (next.goal - next.from)) * 100) : 100;
  const done = claimed === steps;

  return (
    <article
      className={`panel flex h-full flex-col gap-4 p-5 ${claimable.length > 0 ? "ring-2 ring-accent" : ""}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-full ${
            done ? "bg-tier-legendary/20 text-tier-legendary" : "bg-bg-deep text-ink"
          }`}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-black">
            {family.name}
            {reached > 0 && <span className="ml-1.5 text-muted">{ROMAN[reached - 1] ?? reached}</span>}
          </h3>
          <p className="text-sm text-muted">
            {next ? goalText(family, next.goal) : "Tous les paliers sont atteints."}
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between text-xs font-black tabular-nums">
          <span>
            {int.format(value)}
            {next && <span className="text-muted"> / {int.format(next.goal)}</span>}
          </span>
          {next && (
            <span className="text-muted">
              <Coins amount={next.reward} />
            </span>
          )}
        </div>
        <div className="gauge mt-1.5">
          <span style={{ width: `${pct}%` }} />
        </div>
        <ol className="mt-2.5 flex gap-1" aria-label={`${claimed} palier${claimed > 1 ? "s" : ""} sur ${steps}`}>
          {family.steps.map(([goal], i) => (
            <li
              key={goal}
              title={goalText(family, goal)}
              className={`h-1.5 flex-1 rounded-full ${
                i < claimed ? "bg-green" : value >= goal ? "bg-accent" : "bg-bg-deep"
              }`}
            />
          ))}
        </ol>
      </div>

      {claimable.length > 0 && (
        <p className="text-sm font-extrabold text-accent">
          {claimable.length} palier{claimable.length > 1 ? "s" : ""} à réclamer ·{" "}
          <Coins amount={claimable.reduce((sum, c) => sum + c.reward, 0)} />
        </p>
      )}
    </article>
  );
}
