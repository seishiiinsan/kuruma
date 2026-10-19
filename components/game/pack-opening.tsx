"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { ChevronsRight, X } from "lucide-react";
import { openPack, type PackResult } from "@/app/actions/packs";
import { FINISHES, TIERS, formatInt, formatSerial, serialBadge, type CardTier } from "@/lib/cards";
import type { Copy } from "@/lib/game";
import type { PackDef, Wallet } from "@/lib/packs";
import { BODY_CLIP, PackImage, STRIP_CLIP, TEAR_Y } from "../booster";
import { CardBack } from "../reveal-card";
import { RarityDiamonds } from "../rarity-diamonds";
import { TradingCard } from "../trading-card";
import { useWebGL } from "./fx/webgl";
import { THUMB_SIZES, preloadCardPhotos } from "@/lib/preload-cards";

// Three.js loads only when a pack is actually being opened.
const Pack3D = dynamic(() => import("./fx/pack-3d"), { ssr: false });
const RevealFx = dynamic(() => import("./fx/reveal-fx"), { ssr: false });

const GLOW: Partial<Record<CardTier, string>> = {
  rare: "#4fb0ff",
  epic: "#c77dff",
  legendary: "#ffbf2e",
};
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/* ---------- 1. Tear: drag across the top of the pack ---------- */

function PackTear({
  pack,
  reduce,
  onCommit,
  onTorn,
}: {
  pack: PackDef;
  reduce: boolean;
  onCommit: () => void;
  onTorn: () => void;
}) {
  const progress = useMotionValue(0);
  const cutWidth = useTransform(progress, (v) => `${v * 100}%`);
  const lift = useTransform(progress, [0, 1], [0, -12]);
  const liftY = useTransform(progress, [0, 1], [0, -10]);
  const [torn, setTorn] = useState(false);
  const [dragging, setDragging] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const lastX = useRef<number | null>(null);
  const travelled = useRef(0);

  function complete() {
    if (torn) return;
    setTorn(true);
    onCommit();
    setTimeout(onTorn, reduce ? 0 : 650);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (torn) return;
    area.current?.setPointerCapture(event.pointerId);
    lastX.current = event.clientX;
    setDragging(true);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (lastX.current === null || torn || !area.current) return;
    const width = area.current.getBoundingClientRect().width;
    travelled.current += Math.abs(event.clientX - lastX.current) / width;
    lastX.current = event.clientX;
    const value = Math.min(1, travelled.current / 0.8);
    progress.set(value);
    // Past halfway the swipe is a commitment: start the server draw now.
    if (value > 0.5) onCommit();
    if (value >= 1) complete();
  }

  function onPointerUp() {
    lastX.current = null;
    setDragging(false);
    if (!torn) {
      travelled.current = 0;
      animate(progress, 0, { type: "spring", stiffness: 300, damping: 30 });
    }
  }

  function openWithoutSwipe() {
    onCommit();
    animate(progress, 1, { duration: reduce ? 0 : 0.6, ease: "easeInOut" }).then(complete);
  }

  return (
    <div className="flex flex-col items-center">
      <p className="title-drop mb-8 text-center font-display text-lg" aria-live="polite">
        {torn ? "Ouverture…" : "Glisse le long du haut du pack pour le déchirer"}
      </p>

      <motion.div
        className="relative h-[426px] w-[240px] select-none"
        initial={reduce ? false : { y: 40, opacity: 0, scale: 0.94 }}
        animate={torn ? { y: 70, opacity: 0, scale: 0.96 } : { y: 0, opacity: 1, scale: 1 }}
        transition={torn ? { delay: 0.35, duration: 0.35, ease: [0.4, 0, 1, 1] } : { type: "spring", stiffness: 160, damping: 20 }}
      >
        <div
          aria-hidden
          className="absolute -bottom-6 left-1/2 h-8 w-48 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(6_3_30/0.55),transparent)]"
        />

        <span className="absolute inset-0 overflow-hidden" style={{ clipPath: BODY_CLIP }}>
          <PackImage src={pack.image} />
          <span className="pack-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        </span>

        <motion.span
          aria-hidden
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: STRIP_CLIP, rotate: lift, y: liftY, transformOrigin: "100% 10%" }}
          animate={torn ? { y: -90, x: 70, rotate: 22, opacity: 0 } : {}}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        >
          <PackImage src={pack.image} />
        </motion.span>

        <motion.div
          aria-hidden
          className="absolute left-0 h-1 rounded-full bg-white"
          style={{
            top: `calc(${TEAR_Y}% - 2px)`,
            width: cutWidth,
            opacity: torn ? 0 : 1,
            boxShadow: `0 0 0 1px rgb(20 23 43 / 0.45), 0 0 14px 4px ${pack.accent}`,
          }}
        />
        {dragging && !torn && (
          <motion.div
            aria-hidden
            className="absolute size-4 -translate-x-1/2 rounded-full bg-white"
            style={{
              top: `calc(${TEAR_Y}% - 8px)`,
              left: cutWidth,
              boxShadow: `0 0 0 2px ${pack.accent}, 0 0 22px 8px ${pack.accent}`,
            }}
          />
        )}

        {!dragging && !torn && !reduce && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -top-1 flex size-9 items-center justify-center rounded-full bg-accent text-accent-ink shadow-lg"
            style={{ top: `calc(${TEAR_Y}% - 18px)` }}
            animate={{ left: ["-8%", "88%"], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 0.4, ease: "easeInOut" }}
          >
            <ChevronsRight className="size-5" />
          </motion.div>
        )}

        <div
          ref={area}
          aria-hidden
          className="absolute -inset-x-6 -top-8 h-[32%] cursor-grab touch-none active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </motion.div>

      <button
        type="button"
        onClick={openWithoutSwipe}
        disabled={torn}
        className="btn btn-sm mt-12 disabled:invisible"
      >
        Ouvrir sans glisser
      </button>
    </div>
  );
}

/* ---------- 2. Reveal: one card at a time, rarest last ---------- */

type Stage = "back" | "charging" | "turning" | "front";

/** How long a card holds its breath before turning: the rarer, the longer. */
const CHARGE_MS: Partial<Record<CardTier, number>> = { rare: 420, epic: 900, legendary: 1500 };

const CARD_W = "w-[min(72vw,40vh)] min-w-52";

function RevealCardFace({
  copy,
  stage,
  reduce,
  onTurned,
}: {
  copy: Copy;
  stage: Stage;
  reduce: boolean;
  onTurned: () => void;
}) {
  const { card } = copy;
  const glow = GLOW[card.tier];
  const legendary = card.tier === "legendary";

  if (stage === "front") {
    return (
      <motion.div
        initial={reduce ? false : { rotateY: -90, scale: legendary ? 1.18 : 1.06 }}
        animate={{ rotateY: 0, scale: 1 }}
        transition={
          reduce
            ? { duration: 0 }
            : {
                rotateY: { duration: legendary ? 0.55 : 0.26, ease: EASE_OUT },
                scale: { type: "spring", stiffness: 260, damping: legendary ? 12 : 18 },
              }
        }
      >
        <TradingCard card={card} serial={copy.serial} finish={copy.finish} className={CARD_W} sweep={legendary || copy.finish === "holo"} priority />
      </motion.div>
    );
  }

  return (
    <motion.div
      animate={
        stage === "turning"
          ? { rotateY: 90, scale: 1 }
          : stage === "charging"
            ? { x: [0, -4, 4, -3, 3, -1.5, 1.5, 0], scale: [1, 1.03, 1] }
            : { rotateY: 0, x: 0, scale: 1 }
      }
      transition={
        stage === "turning"
          ? { duration: reduce ? 0 : 0.18, ease: "easeIn" }
          : stage === "charging"
            ? { duration: card.tier === "rare" ? 0.4 : 0.55, repeat: Infinity }
            : { duration: 0.2 }
      }
      onAnimationComplete={() => {
        if (stage === "turning") onTurned();
      }}
      className="rounded-[14px]"
      style={
        stage === "charging" && glow
          ? { boxShadow: `0 0 0 3px ${glow}, 0 0 56px 14px ${glow}88` }
          : undefined
      }
    >
      <CardBack className={CARD_W} />
    </motion.div>
  );
}

/** Name, rarity and number of the card just turned, set in like a title card. */
function CardCaption({ copy, isNew, reduce }: { copy: Copy; isNew: boolean; reduce: boolean }) {
  const { card } = copy;
  const badge = serialBadge(copy.serial, card.supply);
  const item = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { delay, duration: 0.35, ease: EASE_OUT },
        };
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <motion.h2 {...item(0.05)} className="title-drop max-w-[22rem] text-balance font-display text-2xl leading-tight sm:text-3xl">
        {card.name}
      </motion.h2>
      <motion.p {...item(0.12)} className="flex flex-wrap items-center justify-center gap-1.5 text-sm font-black">
        <span
          className="inline-flex items-center gap-1.5 rounded-full bg-black/30 px-2.5 py-1"
          style={{ color: TIERS[card.tier].color }}
        >
          <RarityDiamonds tier={card.tier} size={10} />
          {TIERS[card.tier].label}
        </span>
        {isNew && (
          <span className="rounded-full bg-green px-2.5 py-1 shadow-[0_2px_0_var(--green-edge)]" style={{ color: "var(--green-ink)" }}>
            Nouvelle
          </span>
        )}
        {copy.finish !== "standard" && (
          <span className="rounded-full bg-white px-2.5 py-1 text-[#3a2a55]">{FINISHES[copy.finish].label}</span>
        )}
        {badge && <span className="rounded-full bg-tier-legendary px-2.5 py-1 text-[#4a3200]">{badge}</span>}
      </motion.p>
      <motion.p {...item(0.2)} className="text-sm font-semibold text-muted tabular-nums">
        {[card.brand, card.year, formatSerial(copy.serial, card.supply)].filter(Boolean).join(" · ")}
        {card.supply !== null && card.supply <= 1000 && (
          <span className="block">Seulement {formatInt(card.supply)} construites dans le monde.</span>
        )}
      </motion.p>
    </div>
  );
}

function Reveal({
  copies,
  newSlugs,
  reduce,
  fancy,
  onDone,
}: {
  copies: Copy[];
  newSlugs: Set<string>;
  reduce: boolean;
  /** WebGL light and particles behind each card. */
  fancy: boolean;
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<Stage>("back");
  const [flash, setFlash] = useState(0);
  // The swiped-away card leaves in the direction it was thrown.
  const [exitDir, setExitDir] = useState<-1 | 1>(-1);
  const cardBox = useRef<HTMLDivElement>(null);
  const copy = copies[index];
  const { card } = copy;
  const isLast = index === copies.length - 1;
  const behind = copies.length - index - 1;

  function turn() {
    const wait = reduce ? undefined : CHARGE_MS[card.tier];
    if (wait) {
      setStage("charging");
      setTimeout(() => setStage("turning"), wait);
    } else {
      setStage("turning");
    }
  }

  function next(direction: -1 | 1) {
    if (isLast) return onDone();
    setExitDir(direction);
    setIndex((i) => i + 1);
    setStage("back");
  }

  function tap() {
    if (stage === "back") turn();
    else if (stage === "front") next(-1);
  }

  function onTurned() {
    setStage("front");
    if (card.tier === "legendary" && !reduce) setFlash((n) => n + 1);
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      {fancy && <RevealFx tier={card.tier} stage={stage} id={index} anchor={cardBox} />}

      {/* A legendary lands with a flash of gold across the whole screen. */}
      <AnimatePresence>
        {flash > 0 && (
          <motion.div
            key={flash}
            aria-hidden
            className="pointer-events-none absolute inset-0 z-30"
            style={{ background: "radial-gradient(circle at 50% 45%, #fff8dc, #f6d77a 35%, transparent 75%)" }}
            initial={{ opacity: 0.95 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: EASE_OUT }}
          />
        )}
      </AnimatePresence>

      <div className="relative flex h-20 items-end justify-center px-5 pb-6" aria-live="polite">
        {stage === "front" ? (
          <span className="sr-only">
            {TIERS[card.tier].label} · {card.name} · {formatSerial(copy.serial, card.supply)}
          </span>
        ) : (
          <p className="title-drop text-center font-display text-lg">
            {stage === "charging" ? (card.tier === "legendary" ? "Oh… oh !" : "Oh…") : "Touche la carte pour la révéler"}
          </p>
        )}
      </div>

      <motion.div
        ref={cardBox}
        className="relative isolate"
        style={{ perspective: 1000 }}
        animate={flash > 0 && stage === "front" && !reduce ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.35 }}
      >
        {Array.from({ length: Math.min(behind, 3) }, (_, i) => (
          <div
            key={i}
            aria-hidden
            className="absolute inset-0"
            style={{ transform: `translate(${(i + 1) * 5}px, ${(i + 1) * 6}px)`, zIndex: -1 - i }}
          >
            <CardBack className={CARD_W} />
          </div>
        ))}

        <AnimatePresence mode="popLayout" custom={exitDir}>
          <motion.button
            key={index}
            type="button"
            onClick={tap}
            aria-label={stage === "front" ? (isLast ? "Voir le récapitulatif" : "Carte suivante") : "Révéler la carte"}
            className="relative block cursor-pointer touch-pan-y rounded-[14px]"
            drag={stage === "front" && !reduce ? "x" : false}
            dragSnapToOrigin
            dragElastic={0.6}
            onDragEnd={(_, info) => {
              if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 500) {
                next(info.offset.x > 0 ? 1 : -1);
              }
            }}
            custom={exitDir}
            variants={{
              enter: { y: 24, opacity: 0 },
              center: { y: 0, opacity: 1 },
              leave: (dir: -1 | 1) =>
                reduce
                  ? { opacity: 0 }
                  : {
                      x: dir * 320,
                      y: -40,
                      rotate: dir * 18,
                      opacity: 0,
                      // The leaving card must not catch the tap meant for the next one.
                      pointerEvents: "none",
                      transition: { duration: 0.32, ease: [0.4, 0, 1, 1] },
                    },
            }}
            initial={reduce ? false : "enter"}
            animate="center"
            exit="leave"
          >
            <RevealCardFace copy={copy} stage={stage} reduce={reduce} onTurned={onTurned} />
          </motion.button>
        </AnimatePresence>
      </motion.div>

      <div className="relative mt-6 flex min-h-24 items-start justify-center px-5">
        {stage === "front" && (
          <CardCaption key={index} copy={copy} isNew={newSlugs.has(card.slug)} reduce={reduce} />
        )}
      </div>

      <div className="relative mt-4 flex items-center gap-5">
        <ol className="flex gap-2" aria-label="Cartes révélées">
          {copies.map(({ card: c }, i) => {
            const shown = i < index || (i === index && stage === "front");
            return (
              <li
                key={i}
                className={`relative aspect-[5/7] w-7 overflow-hidden rounded-[5px] bg-surface-lo ring-2 transition-transform ${
                  i === index ? "-translate-y-1" : ""
                }`}
                style={{ ["--tw-ring-color" as string]: shown ? TIERS[c.tier].color : "transparent" }}
              >
                {shown ? (
                  <Image src={c.image} alt={c.name} fill sizes={THUMB_SIZES} className="object-cover" />
                ) : (
                  <span className="sr-only">Carte {i + 1} pas encore révélée</span>
                )}
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          onClick={onDone}
          className={isLast && stage === "front" ? "btn btn-gold btn-sm" : "btn btn-sm"}
        >
          {isLast && stage === "front" ? "Voir mes cartes" : "Tout révéler"}
        </button>
      </div>
      {stage === "front" && !isLast && (
        <p className="relative mt-4 text-xs font-bold text-muted">Touche ou fais glisser la carte pour la suivante</p>
      )}
    </div>
  );
}

/* ---------- 3. Summary ---------- */

function Summary({
  pack,
  copies,
  newSlugs,
  canOpenAnother,
  onExit,
  exitLabel,
}: {
  pack: PackDef;
  copies: Copy[];
  newSlugs: Set<string>;
  canOpenAnother: boolean;
  onExit: () => void;
  exitLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <h2 className="title-drop font-display text-3xl sm:text-4xl">
        Ton pack {pack.name}
      </h2>
      <p className="mt-2 text-muted">
        {newSlugs.size > 0
          ? `${newSlugs.size} nouvelle${newSlugs.size > 1 ? "s" : ""} voiture${newSlugs.size > 1 ? "s" : ""} pour ta collection.`
          : "Que des doubles : de quoi proposer des échanges."}
      </p>

      <ul className="mt-10 grid w-full max-w-4xl grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
        {copies.map(({ id, card, serial, finish }, i) => (
          <motion.li
            key={id}
            className="relative"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.06, duration: 0.4, ease: EASE_OUT }}
          >
            <Link href={`/cartes/${card.slug}`} className="block">
              <TradingCard card={card} serial={serial} finish={finish} className="w-full" />
            </Link>
            {newSlugs.has(card.slug) && (
              <span className="absolute -top-2 -right-2 z-10 rounded-full bg-green px-2 py-0.5 text-xs font-black shadow-[0_2px_0_var(--green-edge)]" style={{ color: "var(--green-ink)" }}>
                Nouvelle
              </span>
            )}
          </motion.li>
        ))}
      </ul>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={onExit}
          className="btn btn-gold btn-lg"
        >
          {exitLabel ?? (canOpenAnother ? "Ouvrir un autre pack" : "Retour aux packs")}
        </button>
        {!exitLabel && (
          <Link
            href="/collection"
            className="btn btn-lg"
          >
            Voir ma collection
          </Link>
        )}
      </div>
    </div>
  );
}

/* ---------- Flow ---------- */

type Phase = "tear" | "reveal" | "summary" | "error";

export function PackOpening({
  pack,
  onWallet,
  canOpenAnother,
  onExit,
  exitLabel,
  draw = openPack,
}: {
  pack: PackDef;
  onWallet: (wallet: Wallet) => void;
  canOpenAnother: boolean;
  onExit: () => void;
  /** Replaces "Retour aux packs" on the summary, and hides the collection link (onboarding). */
  exitLabel?: string;
  /** Where the cards come from; the real server draw unless a demo supplies its own. */
  draw?: (packId: string) => Promise<PackResult>;
}) {
  const reduce = useReducedMotion() ?? false;
  const fancy = useWebGL() && !reduce;
  const [phase, setPhase] = useState<Phase>("tear");
  const [copies, setCopies] = useState<Copy[]>([]);
  const [newSlugs, setNewSlugs] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const request = useRef<Promise<PackResult> | null>(null);

  const [committed, setCommitted] = useState(false);

  const photos = useRef<Promise<void> | null>(null);

  function commit() {
    if (request.current) return;
    // Start fetching the photos the moment the draw is known, while the pack is still tearing.
    request.current = draw(pack.id).then((result) => {
      if (result.ok) photos.current = preloadCardPhotos(result.copies.map((c) => c.card.image));
      return result;
    });
    setCommitted(true);
  }

  async function onTorn() {
    commit();
    const result = await request.current!;
    if (result.wallet) onWallet(result.wallet);
    if (!result.ok) {
      setError(result.error);
      setPhase("error");
      return;
    }
    await photos.current;
    setCopies(result.copies);
    setNewSlugs(new Set(result.newSlugs));
    setPhase("reveal");
  }

  // Full screen while the pack is open: no page, no nav, nothing to scroll.
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = previous;
    };
  }, []);

  // Leaving is allowed before the draw starts and once the cards are out.
  const canLeave = (phase === "tear" && !committed) || phase === "summary" || phase === "error";
  useEffect(() => {
    if (!canLeave) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onExit();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canLeave, onExit]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Ouverture d'un pack ${pack.name}`}
      className="fixed inset-0 z-[200] isolate overflow-hidden bg-bg-deep"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse 70% 60% at 50% 48%, ${pack.accent}55, transparent 70%), radial-gradient(ellipse 120% 90% at 50% 50%, transparent 55%, rgb(6 3 30 / 0.55))`,
        }}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <span className="inline-flex items-center gap-2 rounded-full bg-black/25 py-1.5 pr-3 pl-2 text-sm font-extrabold">
          <span className="size-2.5 rounded-full" style={{ background: pack.accent }} />
          {pack.name}
        </span>
        {canLeave && (
          <button
            type="button"
            onClick={onExit}
            aria-label="Fermer"
            className="btn btn-sm pointer-events-auto size-11 p-0"
          >
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>

      {phase === "tear" &&
        (fancy ? (
          <Pack3D pack={pack} onCommit={commit} onTorn={onTorn} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-5">
            <PackTear pack={pack} reduce={reduce} onCommit={commit} onTorn={onTorn} />
          </div>
        ))}
      {phase === "reveal" && (
        <Reveal copies={copies} newSlugs={newSlugs} reduce={reduce} fancy={fancy} onDone={() => setPhase("summary")} />
      )}
      {phase === "summary" && (
        <div className="absolute inset-0 flex overflow-y-auto px-5 sm:px-6">
          <div className="m-auto w-full max-w-5xl py-20">
            <Summary pack={pack} copies={copies} newSlugs={newSlugs} canOpenAnother={canOpenAnother} onExit={onExit} exitLabel={exitLabel} />
          </div>
        </div>
      )}
      {phase === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-5 text-center">
          <p role="alert" className="max-w-sm font-extrabold text-danger">
            {error}
          </p>
          <button
            type="button"
            onClick={onExit}
            className="btn btn-lg"
          >
            Retour aux packs
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
}
