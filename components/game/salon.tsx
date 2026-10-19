"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Check, Gift, MapPin } from "lucide-react";
import { claimSalon } from "@/app/actions/economy";
import {
  SALON_FINALE_PACKS,
  SALON_RULES,
  salonCountdown,
  salonDates,
  type SalonBoard,
  type SalonEdition,
  type SalonNow,
} from "@/lib/salons";
import { Coins } from "./coins";
import { MissionRow } from "./missions";
import { buttonClaim, buttonPrimary } from "./ui";
import { useEconomy } from "./use-economy";

function PackThumb({ edition, size }: { edition: SalonEdition; size: "sm" | "lg" }) {
  const { pack } = edition.salon;
  return (
    <span
      className={`relative block shrink-0 aspect-[528/938] ${size === "lg" ? "w-28 sm:w-36" : "w-10"}`}
      style={{ filter: `drop-shadow(0 ${size === "lg" ? 14 : 6}px ${size === "lg" ? 18 : 8}px ${pack.accent}55)` }}
    >
      <Image src={pack.image} alt="" fill sizes={size === "lg" ? "144px" : "40px"} className="object-contain" />
    </span>
  );
}

/** The show on now: its pack, its three challenges and the finale. */
function LiveShow({ now, board }: { now: Extract<SalonNow, { live: true }>; board: SalonBoard | null }) {
  const { pending, result, run } = useEconomy();
  const { salon } = now.edition;
  const challenges = board?.challenges ?? [];
  const ready = challenges.filter((c) => c.progress >= c.goal && !c.claimed);
  const total = ready.reduce((sum, c) => sum + c.reward, 0);
  const allDone = challenges.length > 0 && challenges.every((c) => c.progress >= c.goal);
  const finaleReady = allDone && !board?.finaleClaimed;

  return (
    <div className="panel relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(120% 90% at 0% 0%, ${salon.pack.accent}33, transparent 60%)` }}
      />
      <div className="relative grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10">
        <div className="flex items-start gap-4 sm:gap-6">
          <PackThumb edition={now.edition} size="lg" />
          <div className="min-w-0 pt-1">
            <p className="inline-flex items-center gap-2 rounded-full bg-bg-deep px-3 py-1 text-xs font-black">
              <span className="size-2 animate-pulse rounded-full" style={{ background: salon.pack.accent }} />
              En ce moment · {now.daysLeft === 0 ? "dernier jour" : `encore ${now.daysLeft + 1} jours`}
            </p>
            <h3 className="title-drop mt-3 font-display text-2xl leading-tight sm:text-3xl">{salon.name}</h3>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-muted">
              <MapPin className="size-4 shrink-0" aria-hidden />
              {salon.place}, {salonDates(now.edition)}
            </p>
            <p className="mt-3 max-w-sm text-pretty text-sm text-muted">{salon.blurb}</p>
            <Link href={`/boosters?pack=${salon.pack.id}`} className={`${buttonPrimary} mt-4`}>
              Ouvrir le pack {salon.pack.name}
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3 px-3">
            <h4 className="font-black">Défis du salon</h4>
            <span className="text-xs font-bold text-muted">Jusqu&apos;à dimanche soir</span>
          </div>
          <ul className="panel-sunken p-1">
            {challenges.map((c) => (
              <MissionRow key={c.ord} mission={c} />
            ))}
            <li
              className={`flex items-center gap-3 rounded-xl px-3 py-3 ${finaleReady ? "bg-accent/10" : ""}`}
            >
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                  board?.finaleClaimed ? "bg-green/20 text-green" : finaleReady ? "bg-accent text-accent-ink" : "bg-bg-deep text-muted"
                }`}
              >
                {board?.finaleClaimed ? <Check className="size-4" strokeWidth={3} aria-hidden /> : <Gift className="size-4" aria-hidden />}
              </span>
              <span className={`min-w-0 flex-1 font-extrabold ${board?.finaleClaimed ? "text-muted line-through decoration-2" : ""}`}>
                Relève les {challenges.length || 3} défis
              </span>
              <span className={`shrink-0 text-sm font-black ${board?.finaleClaimed ? "text-muted" : ""}`}>
                {board?.finaleClaimed ? "Réclamée" : `+${SALON_FINALE_PACKS} packs`}
              </span>
            </li>
          </ul>
          {(ready.length > 0 || finaleReady || result) && (
            <div className="flex flex-col items-start gap-1 px-1 sm:flex-row sm:items-center sm:gap-3">
              {(ready.length > 0 || finaleReady) && (
                <button type="button" disabled={pending} onClick={() => run(claimSalon)} className={buttonClaim}>
                  <Gift className="size-4" aria-hidden />
                  {pending ? (
                    "Réclamation…"
                  ) : (
                    <>
                      Réclamer
                      {total > 0 && <> · <Coins amount={total} /></>}
                      {finaleReady && ` · +${SALON_FINALE_PACKS} packs`}
                    </>
                  )}
                </button>
              )}
              {result && (
                <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "font-extrabold text-green" : "font-bold text-danger"}`}>
                  {result.text}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Between shows: the next one, and what it brings. */
function NextShow({ now }: { now: Extract<SalonNow, { live: false }> }) {
  const { salon } = now.edition;
  return (
    <div className="panel relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(120% 90% at 0% 0%, ${salon.pack.accent}26, transparent 60%)` }}
      />
      <div className="relative flex items-start gap-4 p-4 sm:gap-6 sm:p-6">
        <PackThumb edition={now.edition} size="lg" />
        <div className="min-w-0 pt-1">
          <p className="inline-flex items-center gap-2 rounded-full bg-bg-deep px-3 py-1 text-xs font-black">
            <CalendarDays className="size-3.5" aria-hidden />
            Prochain salon · {salonCountdown(now.days).toLowerCase()}
          </p>
          <h3 className="title-drop mt-3 font-display text-2xl leading-tight sm:text-3xl">{salon.name}</h3>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-bold text-muted">
            <MapPin className="size-4 shrink-0" aria-hidden />
            {salon.place}, {salonDates(now.edition)}
          </p>
          <p className="mt-3 max-w-md text-pretty text-sm text-muted">
            {salon.blurb} Une semaine pour ouvrir le pack <strong className="font-extrabold text-ink">{salon.pack.name}</strong>,
            relever trois défis et gagner {SALON_FINALE_PACKS} packs bonus.
          </p>
        </div>
      </div>
    </div>
  );
}

function Calendar({ editions, current }: { editions: SalonEdition[]; current: string }) {
  return (
    <ol className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 lg:grid-cols-6">
      {editions.map((e) => {
        const on = e.period === current;
        return (
          <li
            key={e.period}
            className={`panel-sunken flex w-44 shrink-0 snap-start items-center gap-3 p-3 sm:w-auto ${on ? "ring-2" : ""}`}
            style={on ? ({ "--tw-ring-color": e.salon.pack.accent } as CSSProperties) : undefined}
          >
            <PackThumb edition={e} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold">{e.salon.name}</span>
              <span className="block text-xs font-bold text-muted">
                {salonDates(e).replace(/^du /, "")}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function Salons({
  now,
  board,
  calendar,
}: {
  now: SalonNow;
  board: SalonBoard | null;
  calendar: SalonEdition[];
}) {
  return (
    <section id="salons" className="scroll-mt-24">
      <div>
        <h2 className="title-drop font-display text-xl sm:text-2xl">Salons auto</h2>
        <p className="mt-1 max-w-2xl text-pretty text-sm text-muted">{SALON_RULES}</p>
      </div>
      <div className="mt-6 flex flex-col gap-4">
        {now.live ? <LiveShow now={now} board={board} /> : <NextShow now={now} />}
        <Calendar editions={calendar} current={now.live ? now.edition.period : ""} />
      </div>
    </section>
  );
}
