import { Check, ChevronDown, Lock } from "lucide-react";
import type { PlayerRef } from "@/lib/game";
import { GRADES, MAX_LEVEL, XP_SOURCES, garageSlots, gradeOf, nextGrade, rewardsText, shopDiscount, type Permit } from "@/lib/permit";
import { FramedAvatar } from "../cosmetics";

const int = new Intl.NumberFormat("fr-FR");

/** Grade and level next to a player's name, on any profile. */
export function PermitChip({ level, className = "" }: { level: number; className?: string }) {
  const grade = gradeOf(level);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-bg-deep/70 py-1 pr-3 pl-1 text-sm font-extrabold ${className}`}
      title={`Permis : ${grade.name}, niveau ${level}`}
    >
      <span
        className="grid h-6 min-w-6 place-items-center rounded-full px-1.5 font-display text-xs text-bg-deep tabular-nums"
        style={{ background: grade.tint }}
      >
        {level}
      </span>
      {grade.name}
    </span>
  );
}

/** The licence itself: a little plastic card with the player on it. */
function LicenceCard({ player, level }: { player: Pick<PlayerRef, "name" | "avatarUrl" | "look">; level: number }) {
  const grade = gradeOf(level);
  return (
    <div
      className="relative aspect-[85.6/54] w-full max-w-[22rem] overflow-hidden rounded-2xl p-4 text-card-ink shadow-[var(--shadow-card)] ring-1 ring-white/30 ring-inset"
      style={{
        background: `radial-gradient(circle at 85% 15%, ${grade.tint}66, transparent 55%), repeating-linear-gradient(135deg, transparent 0 9px, rgb(26 20 66 / 0.035) 9px 10px), linear-gradient(160deg, #fdfcff, #e9e6f8)`,
      }}
    >
      <div className="flex items-center justify-between">
        <p className="text-[0.6rem] font-black tracking-[0.18em] text-card-muted uppercase">Permis de conduire</p>
        <p className="font-display text-[0.7rem] text-card-muted">KURUMA</p>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <FramedAvatar player={player} size={56} className="shrink-0" />
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold">{player.name}</p>
          <p className="truncate font-display text-lg leading-tight" style={{ color: grade.tint === "#ffcc33" ? "#b07a00" : undefined }}>
            {grade.name}
          </p>
        </div>
      </div>
      <div className="absolute right-4 bottom-3 flex items-baseline gap-1">
        <span className="text-[0.65rem] font-black text-card-muted uppercase">Niv.</span>
        <span className="font-display text-4xl leading-none tabular-nums" style={{ color: grade.tint, textShadow: "0 2px 0 rgb(26 20 66 / 0.25)" }}>
          {level}
        </span>
      </div>
      <div aria-hidden className="absolute bottom-3 left-4 h-1.5 w-16 rounded-full" style={{ background: grade.tint }} />
    </div>
  );
}

/** The signed-in player's permit: progress, perks and the road ahead. */
export function PermitPanel({ player, permit }: { player: Pick<PlayerRef, "name" | "avatarUrl" | "look">; permit: Permit }) {
  const { level, xp, from, to } = permit;
  const grade = gradeOf(level);
  const next = nextGrade(level);
  // The level never drops, so the experience can sit below its own level.
  const done = to === null ? 1 : Math.min(Math.max((xp - from) / (to - from), 0), 1);
  const discount = shopDiscount(level);

  return (
    <div className="panel p-5 sm:p-8">
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:gap-8">
        <LicenceCard player={player} level={level} />

        <div className="flex-1">
          {to === null ? (
            <p className="font-display text-lg">Niveau maximum atteint.</p>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-display text-lg">
                  Niveau {level} <span className="text-muted">→ {level + 1}</span>
                </p>
                <p className="text-sm font-bold text-muted tabular-nums">
                  {int.format(Math.max(xp, from))} / {int.format(to)} XP
                </p>
              </div>
              <div
                role="progressbar"
                aria-valuemin={from}
                aria-valuemax={to}
                aria-valuenow={Math.max(xp, from)}
                aria-label={`Expérience vers le niveau ${level + 1}`}
                className="mt-2 h-3 overflow-hidden rounded-full bg-bg-deep"
              >
                <div className="h-full rounded-full transition-[width]" style={{ width: `${done * 100}%`, background: grade.tint }} />
              </div>
            </>
          )}

          <ul className="mt-4 flex flex-wrap gap-2 text-sm">
            <li className="rounded-full bg-surface-lo px-3 py-1 font-bold">{garageSlots(level)} places au garage</li>
            <li className="rounded-full bg-surface-lo px-3 py-1 font-bold">
              {discount > 0 ? `−${discount} % en boutique` : "Pas encore de réduction en boutique"}
            </li>
          </ul>

          {next && (
            <p className="mt-4 text-sm text-pretty text-muted">
              Niveau {next.level} :{" "}
              <strong className="font-extrabold text-ink">{next.name}</strong>
              {", "}
              {rewardsText(next)}.
            </p>
          )}
        </div>
      </div>

      <details className="group mt-6 border-t border-white/10 pt-4">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-extrabold text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          Tous les permis et comment gagner de l&apos;XP
        </summary>

        <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {GRADES.map((g) => {
            const reached = level >= g.level;
            return (
              <li
                key={g.level}
                className={`rounded-xl p-3 ${reached ? "bg-surface-lo" : "bg-bg-deep/60"}`}
                style={g === grade ? { boxShadow: `inset 0 0 0 2px ${g.tint}` } : undefined}
              >
                <p className="flex items-center gap-2 font-extrabold">
                  {reached ? (
                    <Check className="size-4 shrink-0" style={{ color: g.tint }} aria-label="Obtenu" />
                  ) : (
                    <Lock className="size-4 shrink-0 text-muted" aria-label="À venir" />
                  )}
                  {g.name}
                </p>
                <p className="mt-0.5 text-xs font-bold text-muted">Niveau {g.level}</p>
                <ul className="mt-2 flex flex-col gap-0.5 text-xs text-ink/80">
                  {g.rewards.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>

        <div className="mt-5">
          <p className="text-sm font-extrabold">Gagner de l&apos;XP</p>
          <ul className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {XP_SOURCES.map((s) => (
              <li key={s.label} className="flex items-baseline justify-between gap-3 border-b border-white/5 py-1">
                <span className="text-ink/85">
                  {s.label}
                  {s.hint && <span className="text-muted"> ({s.hint})</span>}
                </span>
                <span className="font-black text-accent tabular-nums">+{s.xp}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Ton niveau ne redescend jamais. Il plafonne au niveau {MAX_LEVEL}.
          </p>
        </div>
      </details>
    </div>
  );
}
