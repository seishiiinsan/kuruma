"use client";

import { useState, useTransition } from "react";
import type { EconomyResult } from "@/app/actions/economy";
import { setWallet } from "@/lib/wallet-store";

/**
 * Runs an economy server action: pending state, the fresh wallet into the
 * shared store (header balance, badges), and the outcome as a message.
 */
export function useEconomy() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  function run(action: () => Promise<EconomyResult>, onDone?: (ok: boolean) => void) {
    start(async () => {
      const outcome = await action();
      if (outcome.wallet) setWallet(outcome.wallet);
      setResult(outcome.ok ? { ok: true, text: outcome.message } : { ok: false, text: outcome.error });
      onDone?.(outcome.ok);
    });
  }

  return { pending, result, run, clear: () => setResult(null) };
}
