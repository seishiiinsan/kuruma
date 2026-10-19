"use server";

import { refresh } from "next/cache";
import type { EconomyResult } from "@/app/actions/economy";
import { cosmeticById, type Look } from "@/lib/cosmetics";
import { readWallet } from "@/lib/packs-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function explain(message: string) {
  if (message.includes("not enough coins")) return "Pas assez de jetons.";
  if (message.includes("already owned")) return "Tu l'as déjà.";
  if (message.includes("not for sale")) return "Celui-là ne s'achète pas : il se débloque en jouant.";
  if (message.includes("not owned")) return "Tu ne l'as pas encore débloqué.";
  if (message.includes("too many badges")) return "Trois badges au plus.";
  return "Ça n'a pas marché. Réessaie.";
}

export async function buyCosmetic(id: string): Promise<EconomyResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("buy_cosmetic", { p_id: id });
  if (error) return { ok: false, error: explain(error.message), wallet: await readWallet(supabase) };
  refresh();
  return {
    ok: true,
    message: `${cosmeticById(id)?.name ?? "Acheté"} : à toi. Équipe-le quand tu veux.`,
    wallet: await readWallet(supabase),
  };
}

export async function equipLook(look: Look): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("equip_cosmetics", {
    p_title: look.titleId,
    p_frame: look.frameId,
    p_banner: look.bannerId,
    p_badges: look.badgeIds,
  });
  if (error) return { ok: false, error: explain(error.message) };
  refresh();
  return { ok: true };
}
