import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ACHIEVEMENTS, TOTAL_ACHIEVEMENT_REWARDS, familyProgress } from "@/lib/economy";
import { getViewer } from "@/lib/game";
import { getWallet } from "@/lib/packs-server";
import { salonCalendar, salonOf } from "@/lib/salons";
import { getMyAchievements, getMyMissions, getMySalon } from "@/lib/shop";
import { AchievementCard, ClaimAll, DailyBonus } from "@/components/game/achievements";
import { Coins } from "@/components/game/coins";
import { Missions } from "@/components/game/missions";
import { Salons } from "@/components/game/salon";
import { PageHeader } from "@/components/game/ui";

export const metadata: Metadata = { title: "Succès — Kuruma" };

async function Body() {
  const viewer = await getViewer();
  if (!viewer) redirect("/connexion");
  const [wallet, { metrics, claimed }, missions, salon] = await Promise.all([
    getWallet(),
    getMyAchievements(viewer.id),
    getMyMissions(),
    getMySalon(),
  ]);
  const show = salonOf();

  const families = ACHIEVEMENTS.map((family) => familyProgress(family, metrics, claimed))
    // Rewards waiting first, then the closest next step.
    .sort(
      (a, b) =>
        b.claimable.length - a.claimable.length ||
        Number(a.next === null) - Number(b.next === null) ||
        (b.next ? (b.value - b.next.from) / (b.next.goal - b.next.from) : 0) -
          (a.next ? (a.value - a.next.from) / (a.next.goal - a.next.from) : 0),
    );
  const pending = families.reduce((sum, f) => sum + f.claimable.reduce((s, c) => s + c.reward, 0), 0);
  const earned = families.reduce(
    (sum, f) => sum + f.family.steps.slice(0, f.claimed).reduce((s, [, reward]) => s + reward, 0),
    0,
  );
  const stepsDone = families.reduce((n, f) => n + f.claimed, 0);
  const stepsTotal = ACHIEVEMENTS.reduce((n, f) => n + f.steps.length, 0);

  return (
    <div className="flex flex-col gap-10">
      <DailyBonus wallet={wallet} />

      {show.live && <Salons now={show} board={salon} calendar={salonCalendar()} />}

      <Missions missions={missions} wallet={wallet} />

      {!show.live && <Salons now={show} board={null} calendar={salonCalendar()} />}

      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="title-drop font-display text-xl sm:text-2xl">Paliers</h2>
            <p className="mt-1 text-sm text-muted">
              {stepsDone} / {stepsTotal} paliers réclamés · <Coins amount={earned} /> gagnés sur{" "}
              <Coins amount={TOTAL_ACHIEVEMENT_REWARDS} />
            </p>
          </div>
          <ClaimAll wallet={wallet} total={pending} />
        </div>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {families.map((progress) => (
            <li key={progress.family.metric}>
              <AchievementCard progress={progress} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function AchievementsPage() {
  return (
    <>
      <PageHeader
        title="Succès"
        description="Salons, missions du jour, de la semaine et paliers : tout rapporte des jetons, à dépenser en boutique. Collectionne, ouvre, échange : tout compte."
      />
      <Suspense fallback={<div className="h-96 panel-sunken animate-pulse" />}>
        <Body />
      </Suspense>
    </>
  );
}
