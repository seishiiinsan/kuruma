"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeftRight, ArrowRight, Store, Timer, Trophy } from "lucide-react";
import { finishOnboarding } from "@/app/actions/onboarding";
import { TIERS, TIER_ORDER, formatInt } from "@/lib/cards";
import { MAX_PACKS, PACKS, REFILL_MINUTES, oddsOf, packSize, type Wallet } from "@/lib/packs";
import { MIN_ACCOUNT_DAYS, MIN_DISCORD_DAYS, TRADES_PER_DAY } from "@/lib/trust";
import { setWallet, useWallet } from "@/lib/wallet-store";
import { RarityDiamonds } from "../rarity-diamonds";
import { PackOpening } from "./pack-opening";

const FIRST_PACK = PACKS[0];
const STEPS = ["Premier pack", "Rareté", "Score", "Échanges"] as const;

function Steps({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Étapes">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            aria-current={i === current ? "step" : undefined}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === current ? "w-8 bg-accent" : i < current ? "w-2 bg-accent/60" : "w-2 bg-white/15"
            }`}
          />
          <span className="sr-only">
            {label}
            {i < current ? " (fait)" : ""}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Shell({
  step,
  title,
  children,
  next,
  onNext,
  pending,
  onSkip,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
  next: string;
  onNext: () => void;
  pending?: boolean;
  onSkip: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <Steps current={step} />
        <button
          type="button"
          onClick={onSkip}
          disabled={pending}
          className="text-sm font-bold text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Passer le tutoriel
        </button>
      </div>
      <h1 className="title-drop text-balance font-display text-[2rem] leading-[1.05] sm:text-[2.75rem]">{title}</h1>
      <div className="flex flex-col gap-5 text-pretty">{children}</div>
      <button type="button" onClick={onNext} disabled={pending} className="btn btn-gold btn-lg self-start">
        {next}
        <ArrowRight className="size-5" aria-hidden />
      </button>
    </div>
  );
}

export function Welcome({
  name,
  catalogueSize,
  initialWallet,
  tradeNote,
}: {
  name: string;
  catalogueSize: number;
  initialWallet: Wallet;
  /** When trades open for this player, if they aren't open yet. */
  tradeNote: string | null;
}) {
  const wallet = useWallet(initialWallet);
  const [step, setStep] = useState(0);
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState(false);
  const [pending, start] = useTransition();
  const finish = () => start(() => finishOnboarding());
  const odds = oddsOf(FIRST_PACK);
  const hasPack = wallet.available + wallet.bonus > 0;

  if (opening) {
    return (
      <PackOpening
        pack={FIRST_PACK}
        onWallet={setWallet}
        canOpenAnother={false}
        exitLabel="Continuer le tutoriel"
        onExit={() => {
          setOpening(false);
          setOpened(true);
          setStep(1);
        }}
      />
    );
  }

  if (step === 0) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-10 md:flex-row md:gap-14">
        <div className="relative aspect-[3/4] w-48 shrink-0 -rotate-6 drop-shadow-[0_24px_40px_rgb(0_0_0/0.5)] sm:w-60">
          <Image src={FIRST_PACK.image} alt={`Pack ${FIRST_PACK.name}`} fill sizes="240px" className="object-contain" priority />
        </div>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <Steps current={0} />
            <button
              type="button"
              onClick={finish}
              disabled={pending}
              className="text-sm font-bold text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              Passer le tutoriel
            </button>
          </div>
          <h1 className="title-drop text-balance font-display text-[2rem] leading-[1.05] sm:text-[2.75rem]">
            Bienvenue au garage, {name}
          </h1>
          <p className="text-pretty text-muted">
            Kuruma compte {formatInt(catalogueSize)} vraies voitures. Chaque carte est un exemplaire numéroté, jamais
            plus que la production réelle : une voiture sortie à 106 unités n&apos;aura jamais que 106 cartes.
          </p>
          <p className="text-pretty text-muted">
            Ton premier pack est offert. Déchire le haut de l&apos;emballage pour l&apos;ouvrir.
          </p>
          {hasPack ? (
            <button type="button" onClick={() => setOpening(true)} className="btn btn-gold btn-lg self-start">
              Ouvrir mon premier pack
            </button>
          ) : (
            <button type="button" onClick={() => setStep(1)} className="btn btn-gold btn-lg self-start">
              Continuer
              <ArrowRight className="size-5" aria-hidden />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <Shell
        step={1}
        title={opened ? "Tes cartes ont une rareté" : "Quatre raretés"}
        next="Et le score ?"
        onNext={() => setStep(2)}
        onSkip={finish}
        pending={pending}
      >
        <p className="text-muted">
          Les losanges sous chaque carte disent sa rareté. Plus une voiture est rare, plus elle sort peu des packs et plus
          elle vaut cher au marché.
        </p>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TIER_ORDER.map((tier) => (
            <li key={tier} className="panel-sunken flex flex-col items-center gap-2 px-3 py-4 text-center">
              <RarityDiamonds tier={tier} size={11} />
              <span className="font-display text-lg" style={{ color: TIERS[tier].color }}>
                {TIERS[tier].label}
              </span>
              <span className="text-xs text-muted tabular-nums">
                {odds[0]?.rows.find(([t]) => t === tier)?.[1] ?? 0} % par carte
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          Un pack {FIRST_PACK.name} contient {packSize(FIRST_PACK)} cartes, et la dernière est toujours rare ou
          mieux. Les packs premium de la boutique ont de meilleures chances.
        </p>
      </Shell>
    );
  }

  if (step === 2) {
    return (
      <Shell step={2} title="Ton score, ton classement" next="Et les échanges ?" onNext={() => setStep(3)} onSkip={finish} pending={pending}>
        <p className="text-muted">
          Chaque voiture différente de ta collection rapporte des points selon sa rareté. Elle compte une seule fois :
          les doubles ne montent pas ton score, ils servent à échanger ou à revendre.
        </p>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TIER_ORDER.map((tier) => (
            <li key={tier} className="panel-sunken flex flex-col items-center gap-1 px-3 py-4 text-center">
              <span className="title-drop font-display text-3xl tabular-nums" style={{ color: TIERS[tier].color }}>
                {TIERS[tier].points}
              </span>
              <span className="text-xs text-muted">points · {TIERS[tier].label.toLowerCase()}</span>
            </li>
          ))}
        </ul>
        <p className="flex items-start gap-3 text-muted">
          <Trophy className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <span>
            Terminer une série de l&apos;album ajoute des points et des packs bonus. Le{" "}
            <Link href="/classement" className="font-bold text-ink underline-offset-4 hover:underline">
              classement
            </Link>{" "}
            range tous les joueurs par score.
          </span>
        </p>
      </Shell>
    );
  }

  return (
    <Shell step={3} title="Échanger, vendre, revenir" next="C'est parti" onNext={finish} onSkip={finish} pending={pending}>
      <ul className="flex flex-col gap-4 text-muted">
        <li className="flex items-start gap-3">
          <ArrowLeftRight className="mt-0.5 size-5 shrink-0 text-blue" aria-hidden />
          <span>
            <strong className="font-extrabold text-ink">Échanges.</strong> Propose jusqu&apos;à 5 de tes cartes contre 5 des
            siennes à n&apos;importe quel joueur. Rien ne bouge tant qu&apos;il n&apos;a pas accepté.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <Store className="mt-0.5 size-5 shrink-0 text-green" aria-hidden />
          <span>
            <strong className="font-extrabold text-ink">Marché et boutique.</strong> Tes jetons se gagnent en jouant (prime
            du jour, missions, succès) et achètent des voitures. Chaque voiture a une cote, qui suit les ventes.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <Timer className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <span>
            <strong className="font-extrabold text-ink">Packs gratuits.</strong> Un nouveau pack toutes les{" "}
            {REFILL_MINUTES} minutes, jusqu&apos;à {MAX_PACKS} en réserve. Ouvre-les avant que la réserve soit pleine.
          </span>
        </li>
      </ul>
      <p className="panel-sunken px-4 py-3 text-sm text-muted">
        {tradeNote ??
          `Pour protéger la cote contre les comptes multiples, échanges et marché ouvrent après ${MIN_ACCOUNT_DAYS} jours de jeu, avec un compte Discord de plus de ${MIN_DISCORD_DAYS} jours, et ${TRADES_PER_DAY} échanges par 24 h au plus.`}
      </p>
    </Shell>
  );
}
