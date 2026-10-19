"use server";

import { refresh } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type GarageResult = { ok: true } | { ok: false; error: string };

/** Replaces the signed-in player's garage with these copies, in order. */
export async function saveGarage(copyIds: string[]): Promise<GarageResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_garage", { p_copies: copyIds });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("not your card")
        ? "Une de ces cartes n'est plus à toi."
        : error.message.includes("garage is full")
          ? "Ton garage est plein : monte de niveau sur ton permis pour gagner une place."
          : "Le garage n'a pas pu être enregistré. Réessaie.",
    };
  }
  refresh();
  return { ok: true };
}
