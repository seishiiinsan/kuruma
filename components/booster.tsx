"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { byRarity, type CardFace } from "@/lib/cards";
import { RevealCard } from "./reveal-card";

export type Phase = "sealed" | "tearing" | "open";

/* Tear line just under the top heat seal of pack.jpg (seal ends ~8%). */
export const TEAR_Y = 11;
const TEAR_POINTS = [0, 6, 12, 19, 25, 31, 38, 44, 50, 56, 62, 69, 75, 81, 88, 94, 100];
const tearLine = TEAR_POINTS.map(
  (x, i) => `${x}% ${TEAR_Y + (i % 2 === 0 ? -1.1 : 1.1)}%`,
);
export const BODY_CLIP = `polygon(${[...tearLine, "100% 100%", "0% 100%"].join(", ")})`;
export const STRIP_CLIP = `polygon(0% 0%, 100% 0%, ${[...tearLine].reverse().join(", ")})`;

/* Fan slots, left to right; the rarest pull always takes the centre. */
const SLOTS = [
  { x: -224, y: 26, rotate: -12 },
  { x: -112, y: 8, rotate: -6 },
  { x: 0, y: 0, rotate: 0 },
  { x: 112, y: 8, rotate: 6 },
  { x: 224, y: 26, rotate: 12 },
];
const SLOT_FOR_REVEAL = [0, 1, 3, 4, 2];

function drawPack(cards: CardFace[]): CardFace[] {
  const pool = [...cards];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool
    .slice(0, 5)
    .sort((a, b) => byRarity(b, a));
}

export function PackImage({ src = "/booster/edition-01.webp" }: { src?: string }) {
  return (
    <Image
      src={src}
      alt=""
      fill
      sizes="240px"
      priority={false}
      className="object-contain"
    />
  );
}

function Pack({ phase, onOpen }: { phase: Phase; onOpen: () => void }) {
  const sealed = phase === "sealed";
  const torn = phase !== "sealed";

  return (
    <motion.div
      className="absolute left-1/2 top-4 h-[426px] w-[240px] -translate-x-1/2"
      animate={
        phase === "open"
          ? { y: 140, opacity: 0, scale: 0.94 }
          : sealed
            ? { y: [0, -8, 0], opacity: 1, scale: 1 }
            : { y: 0, opacity: 1, scale: 1 }
      }
      transition={
        phase === "open"
          ? { duration: 0.6, delay: 0.15, ease: [0.4, 0, 1, 1] }
          : sealed
            ? { y: { duration: 3.2, repeat: Infinity, ease: "easeInOut" } }
            : { duration: 0.2 }
      }
      style={{ zIndex: 20, pointerEvents: sealed ? "auto" : "none" }}
    >
      <div
        aria-hidden
        className="absolute -bottom-6 left-1/2 h-8 w-48 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(6_3_30/0.55),transparent)]"
      />
      <button
        type="button"
        onClick={onOpen}
        disabled={!sealed}
        aria-label="Ouvrir le booster"
        className="group relative block h-full w-full cursor-pointer rounded-lg transition-transform duration-300 hover:-translate-y-1 disabled:cursor-default"
      >
        <span
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: BODY_CLIP }}
        >
          <PackImage />
          <span className="pack-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </span>

        <motion.span
          aria-hidden
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: STRIP_CLIP, transformOrigin: "8% 10%" }}
          animate={
            torn
              ? { y: -64, x: -46, rotate: -16, opacity: 0 }
              : { y: 0, x: 0, rotate: 0, opacity: 1 }
          }
          transition={{ duration: torn ? 0.5 : 0, ease: [0.22, 1, 0.36, 1] }}
        >
          <PackImage />
        </motion.span>
      </button>
    </motion.div>
  );
}

export function useBooster(pool: CardFace[]) {
  const reduceMotion = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<Phase>("sealed");
  const [pulled, setPulled] = useState<CardFace[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function open() {
    if (phase !== "sealed") return;
    setPulled(drawPack(pool));
    setPhase("tearing");
    timer.current = setTimeout(() => setPhase("open"), reduceMotion ? 0 : 520);
  }

  function reset() {
    clearTimeout(timer.current);
    setPhase("sealed");
  }

  return { phase, pulled, open, reset, reduceMotion };
}

export type Booster = ReturnType<typeof useBooster>;

export function BoosterStage({ booster }: { booster: Booster }) {
  const { phase, pulled, open, reduceMotion } = booster;
  return (
    <div className="relative h-[275px] sm:h-[470px]" aria-live="polite">
      <div
        className="absolute left-1/2 top-0 h-[470px] w-[640px] origin-top -translate-x-1/2 scale-[0.6] sm:scale-100"
        style={{ perspective: 1400 }}
      >
        <Pack phase={phase} onOpen={open} />

        {phase === "open" && (
          <ul aria-label="Cartes obtenues">
            {pulled.map((card, order) => (
              <RevealCard
                key={card.name}
                card={card}
                slot={SLOTS[SLOT_FOR_REVEAL[order]]}
                order={order}
                isFinal={order === pulled.length - 1}
                reduceMotion={reduceMotion}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function BoosterButton({
  booster,
  openLabel = "Ouvrir le booster",
  resetLabel = "Refermer et rejouer",
  disabled = false,
}: {
  booster: Booster;
  openLabel?: string;
  resetLabel?: string;
  disabled?: boolean;
}) {
  const { phase, open, reset } = booster;
  return phase === "open" ? (
    <button type="button" onClick={reset} className="btn btn-lg">
      {resetLabel}
    </button>
  ) : (
    <button
      type="button"
      onClick={open}
      disabled={disabled || phase === "tearing"}
      className="btn btn-gold btn-lg"
    >
      {openLabel}
    </button>
  );
}
