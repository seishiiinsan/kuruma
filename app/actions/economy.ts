"use server";

import { refresh } from "next/cache";
import type { CardTier } from "@/lib/cards";
import { formatCoins as coins } from "@/lib/economy";
import type { Wallet } from "@/lib/packs";
import { readWallet } from "@/lib/packs-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { explainTrust } from "@/lib/trust";

/** Every economy action answers with the fresh wallet, for the client store. */
export type EconomyResult =
  | { ok: true; message: string; wallet: Wallet }
  | { ok: false; error: string; wallet: Wallet | null };

function explain(message: string) {
  const trust = explainTrust(message);
  if (trust) return trust;
  if (message.includes("not enough coins")) return "Pas assez de jetons.";
  if (message.includes("already claimed today")) return "Tu as déjà touché la prime aujourd'hui.";
  if (message.includes("already bought")) return "Tu as déjà acheté cette offre.";
  if (message.includes("offer expired")) return "Cette offre est terminée. La vitrine a changé.";
  if (message.includes("sold out")) return "Tous les exemplaires de cette voiture sont sortis.";
  if (message.includes("no longer available")) return "Un autre joueur l'a achetée avant toi.";
  if (message.includes("price out of range")) return "Ce prix sort de la fourchette autorisée pour cette voiture.";
  if (message.includes("too many listings")) return "Tu as déjà 20 voitures en vente. Retires-en une d'abord.";
  if (message.includes("in a pending trade")) return "Cette carte est dans un échange en cours.";
  if (message.includes("your own listing")) return "C'est ta propre annonce.";
  if (message.includes("not your card")) return "Cette carte n'est plus à toi.";
  if (message.includes("no show this week")) return "Ce salon est terminé. Rendez-vous au prochain.";
  if (message.includes("not sellable")) return "Cette carte ne se revend pas : c'est ta dernière, elle est au garage ou dans un échange.";
  return "Ça n'a pas marché. Réessaie.";
}

async function run(
  call: (supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>) => Promise<
    { error: { message: string } | null; message: string }
  >,
): Promise<EconomyResult> {
  const supabase = await createSupabaseServerClient();
  const { error, message } = await call(supabase);
  if (error) {
    const { data } = await supabase.auth.getClaims();
    return { ok: false, error: explain(error.message), wallet: data?.claims ? await readWallet(supabase) : null };
  }
  refresh();
  return { ok: true, message, wallet: await readWallet(supabase) };
}

export async function claimDaily() {
  return run(async (supabase) => {
    const { data, error } = await supabase.rpc("claim_daily");
    const row = data?.[0];
    return {
      error,
      message: row ? `+${coins(row.reward)} · ${row.streak} jour${row.streak > 1 ? "s" : ""} d'affilée` : "",
    };
  });
}

export async function claimAchievements() {
  return run(async (supabase) => {
    const { data, error } = await supabase.rpc("claim_achievements");
    return { error, message: data ? `+${coins(data)}` : "Rien à réclamer pour l'instant." };
  });
}

export async function claimMissions() {
  return run(async (supabase) => {
    const { data, error } = await supabase.rpc("claim_missions");
    return { error, message: data ? `+${coins(data)}` : "Aucune mission terminée pour l'instant." };
  });
}

export async function claimSalon() {
  return run(async (supabase) => {
    const { data, error } = await supabase.rpc("claim_salon");
    const row = data?.[0];
    const parts = [
      row?.coins ? `+${coins(row.coins)}` : null,
      row?.packs ? `+${row.packs} packs bonus` : null,
    ].filter(Boolean);
    return { error, message: parts.length ? parts.join(" · ") : "Aucun défi terminé pour l'instant." };
  });
}

export async function buyOffer(period: string, slot: number) {
  return run(async (supabase) => {
    const { error } = await supabase.rpc("buy_offer", { p_period: period, p_slot: slot });
    return { error, message: "Achetée. Elle t'attend dans ta collection." };
  });
}

export async function buyUsed(copyId: string) {
  return run(async (supabase) => {
    const { error } = await supabase.rpc("buy_used", { p_copy: copyId });
    return { error, message: "Achetée. Elle t'attend dans ta collection." };
  });
}

export async function sellCopy(copyId: string) {
  return run(async (supabase) => {
    const { data, error } = await supabase.rpc("sell_copy", { p_copy: copyId });
    return { error, message: data ? `Revendue : +${coins(data)}` : "" };
  });
}

export async function sellDuplicates(tier: CardTier) {
  return run(async (supabase) => {
    const { data, error } = await supabase.rpc("sell_duplicates", { p_tier: tier });
    const row = data?.[0];
    return {
      error,
      message:
        row && row.sold > 0
          ? `${row.sold} double${row.sold > 1 ? "s" : ""} revendu${row.sold > 1 ? "s" : ""} : +${coins(row.gained)}`
          : "Aucun double à revendre.",
    };
  });
}

/* ---------- Player market ---------- */

export async function listCopy(copyId: string, price: number) {
  return run(async (supabase) => {
    const { error } = await supabase.rpc("list_copy", { p_copy: copyId, p_price: Math.round(price) });
    return { error, message: "Mise en vente pour 7 jours." };
  });
}

export async function cancelListing(copyId: string) {
  return run(async (supabase) => {
    const { error } = await supabase.rpc("cancel_listing", { p_copy: copyId });
    return { error, message: "Annonce retirée. La carte est revenue dans ta collection." };
  });
}

export async function buyListing(copyId: string) {
  return run(async (supabase) => {
    const { error } = await supabase.rpc("buy_listing", { p_copy: copyId });
    return { error, message: "Achetée. Elle t'attend dans ta collection." };
  });
}
