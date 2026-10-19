"use server";

import { cardBySlug } from "@/lib/catalog";
import { asFinish, byRarity, toFace } from "@/lib/cards";
import type { Copy } from "@/lib/game";
import { packById, type Wallet } from "@/lib/packs";
import { readWallet } from "@/lib/packs-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PackResult =
  | { ok: true; copies: Copy[]; newSlugs: string[]; wallet: Wallet }
  | { ok: false; error: string; wallet: Wallet | null };

/** Fresh wallet for the client store; null when signed out. */
export async function readMyWallet(): Promise<Wallet | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims ? readWallet(supabase) : null;
}

/** `pay`: spend jetons instead of a free pack (always the case for premium packs). */
export async function openPack(packId: string, pay = false): Promise<PackResult> {
  const pack = packById(packId);
  if (!pack) {
    return { ok: false, error: "Ce pack n'existe pas.", wallet: null };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("open_pack", { p_pack: packId, p_pay: pay || !pack.free });

  if (error || !data) {
    const message = error?.message ?? "";
    return {
      ok: false,
      error: message.includes("no packs available")
        ? "Plus de pack disponible pour le moment."
        : message.includes("pack not available")
          ? "Ce pack du week-end n'est plus en vente."
          : message.includes("not enough coins")
            ? "Pas assez de jetons pour ce pack."
            : "L'ouverture a échoué. Réessaie.",
      wallet: await readWallet(supabase),
    };
  }

  // The print is rolled by the database when the copy is minted.
  const { data: prints } = await supabase
    .from("card_copies")
    .select("id, finish")
    .in("id", data.map((row) => row.copy_id));
  const finishes = new Map((prints ?? []).map((p) => [p.id, asFinish(p.finish)]));

  const openedAt = new Date().toISOString();
  const copies = data
    .flatMap((row) => {
      const card = cardBySlug(row.card_slug);
      return card
        ? [
            {
              id: row.copy_id,
              serial: row.serial,
              finish: finishes.get(row.copy_id) ?? ("standard" as const),
              obtainedAt: openedAt,
              card: toFace(card),
            },
          ]
        : [];
    })
    .sort((a, b) => byRarity(b.card, a.card));

  // Cards the player had never owned before this pack.
  const slugs = [...new Set(data.map((row) => row.card_slug))];
  const { data: before } = await supabase
    .from("card_copies")
    .select("card_slug")
    .in("card_slug", slugs)
    .not("id", "in", `(${data.map((row) => row.copy_id).join(",")})`)
    .eq("owner_id", (await supabase.auth.getUser()).data.user!.id);
  const owned = new Set((before ?? []).map((row) => row.card_slug));

  return {
    ok: true,
    copies,
    newSlugs: slugs.filter((slug) => !owned.has(slug)),
    wallet: await readWallet(supabase),
  };
}
