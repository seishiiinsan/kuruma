"use client";

import { useEffect, useRef } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import type { CardFace } from "@/lib/cards";
import { TradingCard } from "./trading-card";

/** Five slots, left to right; the centre one gets the rarest card. */
const FAN = [
  { x: -344, y: 58, rotate: -15, depth: 0.55, width: "w-44" },
  { x: -178, y: 20, rotate: -7, depth: 0.8, width: "w-48" },
  { x: 0, y: 0, rotate: 0, depth: 1, width: "w-56" },
  { x: 178, y: 20, rotate: 7, depth: 0.8, width: "w-48" },
  { x: 344, y: 58, rotate: 15, depth: 0.55, width: "w-44" },
] as const;

const POINTER_SPRING = { stiffness: 60, damping: 18 };

function FanCard({
  card,
  slot,
  index,
  scroll,
  pointerX,
  pointerY,
  still,
}: {
  card: CardFace;
  slot: (typeof FAN)[number];
  index: number;
  scroll: MotionValue<number>;
  pointerX: MotionValue<number>;
  pointerY: MotionValue<number>;
  still: boolean;
}) {
  const x = useTransform(pointerX, (m) => m * 16 * slot.depth);
  const y = useTransform(
    [scroll, pointerY] as MotionValue<number>[],
    ([s, m]: number[]) => -Math.min(s, 700) * 0.16 * slot.depth + m * 10 * slot.depth,
  );

  return (
    <motion.div
      className="absolute left-1/2 top-0"
      style={{ zIndex: Math.round(slot.depth * 10) }}
      initial={still ? false : { opacity: 0, y: 80 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.15 + Math.abs(index - 2) * 0.09,
        type: "spring",
        stiffness: 120,
        damping: 18,
      }}
    >
      <motion.div style={still ? undefined : { x, y }}>
        <div
          style={{
            transform: `translateX(calc(-50% + ${slot.x}px)) translateY(${slot.y}px) rotate(${slot.rotate}deg)`,
          }}
        >
          <TradingCard
            card={card}
            className={slot.width}
            priority={slot.depth === 1}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

export function HeroCards({ cards }: { cards: CardFace[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() ?? false;

  const { scrollY } = useScroll();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const pointerX = useSpring(rawX, POINTER_SPRING);
  const pointerY = useSpring(rawY, POINTER_SPRING);
  const fieldY = useTransform(scrollY, (s) => Math.min(s, 700) * 0.08);

  useEffect(() => {
    if (reduceMotion || !window.matchMedia("(pointer: fine)").matches) return;
    function onMove(event: PointerEvent) {
      rawX.set((event.clientX / window.innerWidth) * 2 - 1);
      rawY.set((event.clientY / window.innerHeight) * 2 - 1);
    }
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [reduceMotion, rawX, rawY]);

  return (
    <div ref={ref} className="relative isolate mx-auto h-[250px] max-w-6xl sm:h-[400px] lg:h-[430px]">
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 bottom-0"
        style={{ zIndex: -1, ...(reduceMotion ? {} : { y: fieldY }) }}
      >
        <div className="absolute left-[10%] top-[8%] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgb(79_176_255/0.35),transparent_68%)]" />
        <div className="absolute right-[8%] top-[2%] h-96 w-96 rounded-full bg-[radial-gradient(circle,rgb(199_125_255/0.35),transparent_68%)]" />
        <div className="absolute left-1/2 top-[22%] h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgb(255_191_46/0.4),transparent_64%)]" />
      </motion.div>

      <div className="absolute inset-x-0 top-5 origin-top scale-[0.56] sm:top-8 sm:scale-[0.82] lg:scale-100">
        {FAN.map((slot, index) => (
          <FanCard
            key={cards[index].slug}
            card={cards[index]}
            slot={slot}
            index={index}
            scroll={scrollY}
            pointerX={pointerX}
            pointerY={pointerY}
            still={reduceMotion}
          />
        ))}
      </div>
    </div>
  );
}
