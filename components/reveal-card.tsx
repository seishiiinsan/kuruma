"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { CardFace } from "@/lib/cards";
import { TradingCard } from "./trading-card";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export function CardBack({ className = "w-36" }: { className?: string }) {
  return (
    <div
      className={`@container relative aspect-[5/7] rounded-[14px] p-[5px] ${className}`}
      style={{
        background: "linear-gradient(150deg, #ffe680, #e0a000 45%, #ffd24d 70%, #c98800)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        className="relative flex h-full flex-col items-center justify-center gap-[5cqw] overflow-hidden rounded-[10px] ring-1 ring-white/20 ring-inset"
        style={{
          backgroundImage:
            "radial-gradient(circle at 50% 42%, rgb(199 125 255 / 0.55), transparent 62%), repeating-linear-gradient(45deg, rgb(255 255 255 / 0.08) 0 1px, transparent 1px 11px), repeating-linear-gradient(-45deg, rgb(255 255 255 / 0.08) 0 1px, transparent 1px 11px), linear-gradient(180deg, #3a2bb0, #241a7a 70%, #160f4d)",
        }}
      >
        <svg viewBox="0 0 100 100" className="w-[48%]" aria-hidden>
          <circle cx="50" cy="50" r="44" fill="none" stroke="#fff" strokeWidth="6" />
          <circle cx="50" cy="50" r="31" fill="none" stroke="rgb(255 255 255 / 0.5)" strokeWidth="2" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <line
              key={angle}
              x1="50"
              y1="36"
              x2="50"
              y2="21"
              stroke="rgb(255 255 255 / 0.75)"
              strokeWidth="3"
              strokeLinecap="round"
              transform={`rotate(${angle} 50 50)`}
            />
          ))}
          <path d="M50 37 63 50 50 63 37 50Z" fill="#ffcc33" />
        </svg>
        <span className="title-drop font-display text-[10cqw] text-white">
          kuruma
        </span>
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[3cqw] bg-accent"
        />
      </div>
    </div>
  );
}

type Face = "back" | "turning" | "front";

export function RevealCard({
  card,
  slot,
  order,
  isFinal,
  reduceMotion,
}: {
  card: CardFace;
  slot: { x: number; y: number; rotate: number };
  order: number;
  isFinal: boolean;
  reduceMotion: boolean;
}) {
  const [face, setFace] = useState<Face>(reduceMotion ? "front" : "back");
  const [landed, setLanded] = useState(false);

  return (
    <motion.li
      className="absolute left-1/2 top-[110px] -ml-[72px] w-36"
      style={{
        zIndex: isFinal ? 15 : 10 - Math.abs(slot.x) / 112,
        perspective: 900,
      }}
      initial={reduceMotion ? false : { x: 0, y: 150, rotate: 0, opacity: 0 }}
      animate={
        reduceMotion
          ? { x: slot.x, y: slot.y, rotate: slot.rotate, opacity: 1 }
          : {
              x: [0, 0, slot.x],
              y: [150, -30, slot.y],
              rotate: [0, 0, slot.rotate],
              opacity: [0, 1, 1],
            }
      }
      transition={{
        duration: 1,
        delay: order * 0.12,
        times: [0, 0.4, 1],
        ease: EASE_OUT,
      }}
      onAnimationComplete={() => setFace((f) => (f === "back" ? "turning" : f))}
    >
      {face === "front" ? (
        <motion.div
          key="front"
          initial={reduceMotion ? false : { rotateY: -90 }}
          animate={isFinal ? { rotateY: 0, scale: [1, 1.1, 1] } : { rotateY: 0 }}
          transition={{ duration: isFinal ? 0.55 : 0.22, ease: "easeOut" }}
          onAnimationComplete={() => setLanded(true)}
        >
          <TradingCard card={card} className="w-36" sweep={isFinal && landed} />
        </motion.div>
      ) : (
        <motion.div
          key="back"
          animate={{ rotateY: face === "turning" ? 90 : 0 }}
          transition={{
            duration: 0.22,
            ease: "easeIn",
            delay: face === "turning" ? order * 0.18 + (isFinal ? 0.5 : 0) : 0,
          }}
          onAnimationComplete={() => {
            if (face === "turning") setFace("front");
          }}
        >
          <CardBack />
        </motion.div>
      )}
    </motion.li>
  );
}
