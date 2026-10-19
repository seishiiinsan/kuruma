"use server";

import { refresh } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { explainTrust } from "@/lib/trust";

export type TradeResult = { ok: true; message: string } | { ok: false; error: string };

const ERRORS: [string, string][] = [
  ["cards changed hands", "Une des cartes a changé de main entre-temps."],
  ["1 to 5 cards", "Un échange compte de 1 à 5 cartes de chaque côté."],
  ["too many pending", "Tu as déjà 20 offres en attente. Annules-en avant d'en envoyer d'autres."],
  ["not pending", "Cette offre n'est plus en attente."],
];

const explain = (message: string) =>
  explainTrust(message) ??
  ERRORS.find(([needle]) => message.includes(needle))?.[1] ??
  "L'opération a échoué. Réessaie.";

export async function proposeTrade(toId: string, give: string[], take: string[]): Promise<TradeResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("create_trade", { p_to: toId, p_give: give, p_take: take });
  if (error) return { ok: false, error: explain(error.message) };
  refresh();
  return { ok: true, message: "Offre envoyée." };
}

const OUTCOMES: Record<string, string> = {
  accepted: "Échange conclu : les cartes sont dans ta collection.",
  declined: "Offre refusée.",
  cancelled: "Offre annulée.",
  expired: "Une des cartes n'est plus disponible : l'offre a expiré.",
};

/** Accept or decline an offer received, or cancel one sent (accept = false). */
export async function respondToTrade(tradeId: string, accept: boolean): Promise<TradeResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("respond_trade", { p_trade: tradeId, p_accept: accept });
  if (error) return { ok: false, error: explain(error.message) };
  refresh();
  return data === "expired" ? { ok: false, error: OUTCOMES.expired } : { ok: true, message: OUTCOMES[data] };
}
