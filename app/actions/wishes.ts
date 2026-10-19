"use server";

import { refresh } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type WishResult = { ok: true } | { ok: false; error: string };

export async function setWish(slug: string, on: boolean): Promise<WishResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_wish", { p_slug: slug, p_on: on });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("too many wishes")
        ? "Ta liste est pleine (60 voitures). Retires-en une pour en ajouter."
        : error.message.includes("already owned")
          ? "Tu l'as déjà dans ta collection."
          : "Ça n'a pas marché. Réessaie.",
    };
  }
  refresh();
  return { ok: true };
}
