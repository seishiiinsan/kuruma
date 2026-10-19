"use server";

import { refresh } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClaimResult = { ok: true; packs: number } | { ok: false; error: string };

export async function claimSeries(seriesId: string): Promise<ClaimResult> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("claim_series", { p_series: seriesId });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("incomplete")
        ? "Il te manque encore une voiture de la série."
        : error.message.includes("already")
          ? "Tu as déjà réclamé cette série."
          : "La réclamation a échoué. Réessaie.",
    };
  }
  refresh();
  return { ok: true, packs: data };
}
