"use client";

import Link from "next/link";
import { Check, Gift, Target } from "lucide-react";
import { claimMissions } from "@/app/actions/economy";
import { MISSION_RULES, missionHref, missionText, type Mission } from "@/lib/missions";
import type { Wallet } from "@/lib/packs";
import { useWallet } from "@/lib/wallet-store";
import { Coins } from "./coins";
import { buttonClaim } from "./ui";
import { useEconomy } from "./use-economy";

const int = new Intl.NumberFormat("fr-FR");

export function MissionRow({
  mission,
}: {
  mission: Pick<Mission, "kind" | "param" | "goal" | "reward" | "progress" | "claimed">;
}) {
  const done = mission.progress >= mission.goal;
  const pct = Math.min(100, (mission.progress / mission.goal) * 100);
  return (
    <li>
      <Link
        href={missionHref(mission)}
        className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-white/5 ${
          done && !mission.claimed ? "bg-accent/10" : ""
        }`}
      >
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
            mission.claimed ? "bg-green/20 text-green" : done ? "bg-accent text-accent-ink" : "bg-bg-deep text-muted"
          }`}
        >
          {mission.claimed || done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : <Target className="size-4" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block font-extrabold ${mission.claimed ? "text-muted line-through decoration-2" : ""}`}>
            {missionText(mission)}
          </span>
          <span className="mt-1.5 flex items-center gap-2">
            <span className="gauge flex-1">
              <span style={{ width: `${pct}%` }} />
            </span>
            <span className="text-xs font-black tabular-nums text-muted">
              {int.format(mission.progress)} / {int.format(mission.goal)}
            </span>
          </span>
        </span>
        <span className={`shrink-0 text-sm font-black ${mission.claimed ? "text-muted" : ""}`}>
          {mission.claimed ? "Réclamée" : <Coins amount={mission.reward} />}
        </span>
      </Link>
    </li>
  );
}

function Board({ title, until, missions }: { title: string; until: string; missions: Mission[] }) {
  return (
    <div className="panel flex flex-col p-2 sm:p-3">
      <div className="flex items-baseline justify-between gap-3 px-3 pt-2 pb-1">
        <h3 className="font-black">{title}</h3>
        <span className="text-xs font-bold text-muted">{until}</span>
      </div>
      <ul>
        {missions.map((m) => (
          <MissionRow key={m.id} mission={m} />
        ))}
      </ul>
    </div>
  );
}

export function Missions({ missions, wallet: initial }: { missions: Mission[]; wallet: Wallet }) {
  const { missions: ready } = useWallet(initial);
  const { pending, result, run } = useEconomy();
  const total = missions.filter((m) => m.progress >= m.goal && !m.claimed).reduce((sum, m) => sum + m.reward, 0);

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="title-drop font-display text-xl sm:text-2xl">Missions</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">{MISSION_RULES}</p>
        </div>
        {(ready > 0 || result) && (
          <div className="flex flex-col items-start gap-1 sm:items-end">
            {ready > 0 && total > 0 && (
              <button type="button" disabled={pending} onClick={() => run(claimMissions)} className={buttonClaim}>
                <Gift className="size-4" aria-hidden />
                {pending ? "Réclamation…" : <>Réclamer · <Coins amount={total} /></>}
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
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Board title="Aujourd'hui" until="Jusqu'à minuit" missions={missions.filter((m) => m.cadence === "day")} />
        <Board title="Cette semaine" until="Jusqu'à dimanche soir" missions={missions.filter((m) => m.cadence === "week")} />
      </div>
    </section>
  );
}
