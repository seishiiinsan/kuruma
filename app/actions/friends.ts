"use server";

import { refresh } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FriendResult = { ok: true } | { ok: false; error: string };

/** Asks a player to be friends, or accepts their request. */
export async function addFriend(playerId: string): Promise<FriendResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("add_friend", { p_to: playerId });
  if (error) {
    return {
      ok: false,
      error: error.message.includes("daily friend limit")
        ? "Tu as envoyé beaucoup de demandes aujourd'hui. Réessaie demain."
        : "La demande n'a pas pu être envoyée. Réessaie.",
    };
  }
  refresh();
  return { ok: true };
}

/** Removes a friend, cancels a request sent or declines one received. */
export async function removeFriend(playerId: string): Promise<FriendResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("remove_friend", { p_other: playerId });
  if (error) return { ok: false, error: "Ça n'a pas marché. Réessaie." };
  refresh();
  return { ok: true };
}
