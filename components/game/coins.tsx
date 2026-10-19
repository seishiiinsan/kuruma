"use client";

import { useId } from "react";
import Link from "next/link";
import { formatCoins } from "@/lib/economy";
import type { Wallet } from "@/lib/packs";
import { useWallet } from "@/lib/wallet-store";

const int = new Intl.NumberFormat("fr-FR");

/** A jeton: gold disc with the Kuruma diamond struck in it. */
export function CoinIcon({ className = "size-[1.15em]" }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" className={`shrink-0 ${className}`} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe680" />
          <stop offset="0.55" stopColor="#ffbf1f" />
          <stop offset="1" stopColor="#e89a00" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="13" r="10" fill="#b36b00" />
      <circle cx="12" cy="11.5" r="10" fill={`url(#${id})`} />
      <circle cx="12" cy="11.5" r="7.2" fill="none" stroke="#c98200" strokeOpacity="0.55" strokeWidth="1.2" />
      <path d="M12 6.8 16.7 11.5 12 16.2 7.3 11.5Z" fill="#c98200" fillOpacity="0.75" />
      <path d="M12 6.8 16.7 11.5 12 11.5Z" fill="#fff6c8" fillOpacity="0.7" />
    </svg>
  );
}

/** An amount of jetons: gold coin, then the number. */
export function Coins({ amount, className = "" }: { amount: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className}`}>
      <CoinIcon />
      <span>{int.format(amount)}</span>
      <span className="sr-only">{amount > 1 ? "jetons" : "jeton"}</span>
    </span>
  );
}

/** The player's live balance, as a HUD pill in the header. */
export function CoinChip({ wallet }: { wallet: Wallet }) {
  const { coins } = useWallet(wallet);
  return (
    <Link
      href="/boutique"
      aria-label={`${formatCoins(coins)}, ouvrir la boutique`}
      className="hud-pill text-sm transition-[filter] hover:brightness-125"
    >
      <CoinIcon className="size-6" />
      {int.format(coins)}
    </Link>
  );
}

/** The live balance, large, for page headers. */
export function CoinBalance({ wallet }: { wallet: Wallet }) {
  const { coins } = useWallet(wallet);
  return (
    <p className="panel flex items-center gap-3 px-4 py-3">
      <CoinIcon className="size-9" />
      <span>
        <span className="block text-xs font-bold text-muted">Ton solde</span>
        <span className="title-drop block font-display text-2xl tabular-nums">
          {int.format(coins)}
          <span className="sr-only"> jetons</span>
        </span>
      </span>
    </p>
  );
}
