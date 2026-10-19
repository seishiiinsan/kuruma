import "server-only";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cosmeticById } from "./cosmetics";

export type Owned = {
  via: "unlock" | "shop";
  obtainedAt: string;
  /** Unlocked by this very visit. */
  fresh: boolean;
};

/** The viewer's cosmetics by id, granting first whatever goal they just reached. */
export async function getMyCosmetics(): Promise<Map<string, Owned>> {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("my_cosmetics");
  return new Map(
    (data ?? [])
      .filter((row) => cosmeticById(row.cosmetic_id))
      .map((row) => [
        row.cosmetic_id,
        { via: row.via as Owned["via"], obtainedAt: row.obtained_at, fresh: row.fresh },
      ]),
  );
}
