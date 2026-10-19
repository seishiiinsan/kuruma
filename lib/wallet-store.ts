"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { readMyWallet } from "@/app/actions/packs";
import { MAX_PACKS, REFILL_MINUTES, type Wallet } from "./packs";

const REFILL_MS = REFILL_MINUTES * 60_000;

/**
 * The one client copy of the wallet (packs and jetons), shared by the nav,
 * the bell, the pack shop and the shop. It counts refills on the client clock, takes every fresh
 * server reading, and re-reads the server when the tab comes back into focus
 * (packs opened in another tab).
 */
type State = Omit<Wallet, "msToNext"> & { deadline: number | null };

let state: State | null = null;
const listeners = new Set<() => void>();
let ticker: ReturnType<typeof setInterval> | undefined;

function emit() {
  for (const listener of listeners) listener();
}

/** Takes a server reading (msToNext is relative to now), unless we already hold a newer one. */
export function setWallet(wallet: Wallet) {
  if (state && wallet.readAt <= state.readAt) return;
  const { msToNext, ...rest } = wallet;
  state = { ...rest, deadline: msToNext === null ? null : Date.now() + msToNext };
  emit();
}

function tick() {
  if (!state || state.deadline === null || Date.now() < state.deadline) return;
  let available = state.available;
  let deadline: number | null = state.deadline;
  while (deadline !== null && Date.now() >= deadline) {
    available = Math.min(MAX_PACKS, available + 1);
    deadline = available >= MAX_PACKS ? null : deadline + REFILL_MS;
  }
  state = { ...state, available, deadline };
  emit();
}

async function resync() {
  if (document.visibilityState !== "visible") return;
  const wallet = await readMyWallet();
  if (wallet) setWallet(wallet);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    ticker = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", resync);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(ticker);
      document.removeEventListener("visibilitychange", resync);
    }
  };
}

/**
 * Current wallet. `initial` is this component's server reading: it seeds the
 * store, and any newer reading (after a server refresh) replaces it.
 */
export function useWallet(initial: Wallet) {
  useEffect(() => setWallet(initial), [initial]);
  const live = useSyncExternalStore(
    subscribe,
    () => state,
    () => null,
  );
  const current = live ?? initial;
  return {
    available: current.available,
    bonus: current.bonus,
    total: current.available + current.bonus,
    coins: current.coins,
    dailyReady: current.dailyReady,
    streak: current.streak,
    claimable: current.claimable,
    missions: current.missions,
    deadline: live?.deadline ?? null,
    ready: live !== null,
  };
}

/** Milliseconds until the next free pack, ticking every second; null when full or before mount. */
export function useCountdown(deadline: number | null) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    const first = setTimeout(() => setNow(Date.now()), 0);
    return () => {
      clearInterval(id);
      clearTimeout(first);
    };
  }, []);
  return deadline !== null && now !== null ? Math.max(0, deadline - now) : null;
}
