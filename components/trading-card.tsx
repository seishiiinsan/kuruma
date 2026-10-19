"use client";

import { useRef } from "react";
import Image from "next/image";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { Star } from "lucide-react";
import {
  FINISHES,
  formatSerial,
  formatSupply,
  serialBadge,
  type CardFace,
  type CardTier,
  type Finish,
} from "@/lib/cards";
import { CARD_PHOTO_SIZES } from "@/lib/preload-cards";
import { RarityDiamonds } from "./rarity-diamonds";

const FRAME: Record<CardTier, string> = {
  common: "linear-gradient(145deg, #f4f5fb, #c8cde0 50%, #eef0f7)",
  rare: "linear-gradient(145deg, #a8dcff, #2f8fff 48%, #c4e8ff)",
  epic: "linear-gradient(145deg, #ecc9ff, #9b4dff 48%, #f3dcff)",
  legendary:
    "linear-gradient(145deg, #ffe59a, #e9a90c 35%, #fff3c4 62%, #d39400)",
};

/* Continuous iridescent film over the whole card. Multiply tints the white
   frame and text area too; dodge-style blends leave white untouched. */
const HOLO =
  "repeating-linear-gradient(115deg, #ff8fcf 0%, #ffd36e 7%, #9dffcb 14%, #86ceff 21%, #c49bff 28%, #ff8fcf 35%)";
const HOLO_SIZE = "300% 300%";

/* Holo print: the frame itself turns to foil, glitter rides over the film. */
const HOLO_FRAME =
  "linear-gradient(135deg, #ffd1ec, #ffe9a8 18%, #b9ffe0 36%, #a8dcff 54%, #dcc4ff 72%, #ffd1ec 90%)";
const GLITTER =
  "radial-gradient(circle at 30% 30%, rgb(255 255 255 / 0.95) 0 0.6px, transparent 1.2px), radial-gradient(circle at 70% 60%, rgb(255 255 255 / 0.7) 0 0.5px, transparent 1px)";

/* Photo d'époque: aged paper, a sepia print and film grain. */
const VINTAGE_FRAME = "linear-gradient(145deg, #f4e8cc, #c9ae7c 50%, #efe0bd)";
const VINTAGE_FACE = "#f6eedb";
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

const SPRING = { stiffness: 260, damping: 22 };

export function TradingCard({
  card,
  serial,
  finish = "standard",
  className = "w-44",
  interactive = true,
  priority = false,
  sweep = false,
  missing = false,
}: {
  card: CardFace;
  /** The copy's number; without it the card shows its model year. */
  serial?: number;
  /** The copy's print; holo and photo d'époque are rare pulls. */
  finish?: Finish;
  className?: string;
  interactive?: boolean;
  priority?: boolean;
  /** One full foil pass when the card lands, for a big reveal. */
  sweep?: boolean;
  /** Not in the player's collection: shown faded, in black and white. */
  missing?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const live = interactive && !reduceMotion && !missing;

  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const hover = useMotionValue(0);

  const rotateX = useSpring(useTransform(py, [0, 1], [9, -9]), SPRING);
  const rotateY = useSpring(useTransform(px, [0, 1], [-11, 11]), SPRING);
  const shine = useSpring(hover, { stiffness: 200, damping: 30 });
  const glareX = useTransform(px, (v) => v * 100);
  const glareY = useTransform(py, (v) => v * 100);
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgb(255 255 255 / 0.55), transparent 55%)`;
  const holoPosition = useMotionTemplate`${glareX}% ${glareY}%`;
  const holoOpacity = useTransform(shine, [0, 1], [0.38, 0.6]);

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds) return;
    px.set((event.clientX - bounds.left) / bounds.width);
    py.set((event.clientY - bounds.top) / bounds.height);
  }

  function handlePointerLeave() {
    hover.set(0);
    px.set(0.5);
    py.set(0.5);
  }

  const holoPrint = finish === "holo" && !missing;
  const vintage = finish === "vintage" && !missing;
  // An old print has no foil, even on a legendary.
  const hasHolo = ((card.tier === "legendary" && !vintage) || holoPrint) && !missing;
  const badge = serial !== undefined ? serialBadge(serial, card.supply) : null;

  return (
    <motion.div
      ref={ref}
      onPointerEnter={live ? () => hover.set(1) : undefined}
      onPointerMove={live ? handlePointerMove : undefined}
      onPointerLeave={live ? handlePointerLeave : undefined}
      style={live ? { rotateX, rotateY, transformPerspective: 900 } : undefined}
      className={`@container relative aspect-[5/7] shrink-0 ${missing ? "opacity-45 grayscale" : ""} ${className}`}
    >
      <div
        className="relative h-full rounded-[14px] p-[5px]"
        style={{
          background: holoPrint ? HOLO_FRAME : vintage ? VINTAGE_FRAME : FRAME[card.tier],
          boxShadow: "var(--shadow-card)",
        }}
      >
        <div
          className="flex h-full flex-col overflow-hidden rounded-[10px] bg-card-face text-card-ink ring-1 ring-card-line"
          style={vintage ? { backgroundColor: VINTAGE_FACE } : undefined}
        >
          {/* Two lines for the name: long models wrap instead of losing their end. */}
          <div className="flex min-h-[calc(2*1.15em+7.5cqw)] items-center px-[5.5cqw] pt-[4cqw] pb-[3.5cqw] text-[max(0.56rem,6.4cqw)]">
            <span className="line-clamp-2 leading-[1.15] font-black tracking-[-0.01em]">{card.name}</span>
          </div>

          {/* A little taller than the 4:3 photos: object-cover trims the sides, never the car's height. */}
          <div className="relative mx-[3cqw] aspect-[10/9] shrink-0 overflow-hidden rounded-[7px] bg-card-line">
            <Image
              src={card.image}
              alt={card.name}
              fill
              sizes={CARD_PHOTO_SIZES}
              priority={priority}
              className={`object-cover ${vintage ? "[filter:sepia(0.75)_contrast(1.1)_saturate(0.7)_brightness(1.03)]" : ""}`}
            />
            {vintage && (
              <>
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-40 mix-blend-multiply"
                  style={{ backgroundImage: GRAIN, backgroundSize: "120px 120px" }}
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 shadow-[inset_0_0_18cqw_rgb(70_45_10/0.55)]"
                />
              </>
            )}
            {(holoPrint || vintage) && (
              <span
                className={`absolute top-[2.5cqw] right-[2.5cqw] rounded-full px-[2.5cqw] py-[0.6cqw] text-[max(0.45rem,4cqw)] font-black tracking-wide uppercase shadow-sm ${
                  vintage ? "bg-[#5b4320] text-[#f6eedb]" : "text-[#3a2a55]"
                }`}
                style={holoPrint ? { backgroundImage: HOLO_FRAME } : undefined}
              >
                {vintage ? "Époque" : FINISHES.holo.label}
              </span>
            )}
          </div>

          {/* Stat chips, TCG style: culture, year, power. */}
          <div className="flex flex-1 flex-col justify-evenly gap-[2cqw] px-[4.5cqw] py-[2.5cqw] text-[max(0.5rem,4.6cqw)] leading-tight">
            {card.brand && <span className="truncate px-[1cqw] font-extrabold text-card-muted">{card.brand}</span>}
            <span className="flex h-[calc(1.25em+1.6cqw)] flex-wrap gap-[1.5cqw] overflow-hidden @max-[6.5rem]:hidden">
              {[card.culture, card.year, card.powerHp ? `${card.powerHp} ch` : null]
                .filter(Boolean)
                .map((stat) => (
                  <span key={String(stat)} className="rounded-full bg-card-line px-[2.5cqw] py-[0.8cqw] font-extrabold tabular-nums whitespace-nowrap">
                    {stat}
                  </span>
                ))}
            </span>
          </div>

          <div className="flex items-center justify-between gap-1 border-t border-card-line px-[5.5cqw] py-[3.5cqw] text-[max(0.5rem,4.6cqw)]">
            <RarityDiamonds tier={card.tier} size="0.85em" />
            <span
              title={badge ?? undefined}
              className={`inline-flex items-center gap-[1cqw] whitespace-nowrap tabular-nums ${
                badge
                  ? "rounded-full bg-[linear-gradient(135deg,#ffe59a,#e9a90c)] px-[2cqw] py-[0.4cqw] font-black text-[#4a3200]"
                  : "font-medium text-card-muted"
              }`}
            >
              {badge && <Star className="size-[0.9em] fill-current" aria-label={badge} />}
              {serial !== undefined
                ? formatSerial(serial, card.supply)
                : card.supply
                  ? `${formatSupply(card.supply)} ex.`
                  : null}
            </span>
          </div>
        </div>

        {hasHolo &&
          (live ? (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[14px] mix-blend-multiply"
              style={{
                backgroundImage: HOLO,
                backgroundSize: HOLO_SIZE,
                backgroundPosition: holoPosition,
                opacity: holoOpacity,
              }}
            />
          ) : (
            <div
              aria-hidden
              className="foil-idle pointer-events-none absolute inset-0 rounded-[14px] opacity-40 mix-blend-multiply"
              style={{ backgroundImage: HOLO, backgroundSize: HOLO_SIZE }}
            />
          ))}

        {holoPrint && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[14px] mix-blend-overlay"
            style={{
              backgroundImage: GLITTER,
              backgroundSize: "7px 7px, 11px 11px",
              backgroundPosition: live ? holoPosition : undefined,
              opacity: live ? holoOpacity : 0.5,
            }}
          />
        )}

        {hasHolo && sweep && !reduceMotion && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[14px] mix-blend-multiply"
            style={{ backgroundImage: HOLO, backgroundSize: HOLO_SIZE }}
            initial={{ backgroundPosition: "100% 0%", opacity: 0.85 }}
            animate={{ backgroundPosition: "0% 100%", opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          />
        )}

        {live && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[14px] mix-blend-overlay"
            style={{ backgroundImage: glare, opacity: shine }}
          />
        )}
      </div>
    </motion.div>
  );
}
