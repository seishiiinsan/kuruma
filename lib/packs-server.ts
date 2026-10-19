import "server-only";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Wallet } from "./packs";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function readWallet(supabase: Client): Promise<Wallet> {
  const { data } = await supabase.rpc("my_pack_wallet");
  const row = data?.[0];
  if (!row) {
    return { available: 0, msToNext: null, bonus: 0, coins: 0, dailyReady: false, streak: 0, claimable: 0, missions: 0, readAt: Date.now() };
  }
  return {
    available: row.available,
    msToNext: row.next_at ? Math.max(0, Date.parse(row.next_at) - Date.now()) : null,
    bonus: row.bonus,
    coins: row.coins,
    dailyReady: row.daily_ready,
    streak: row.streak,
    claimable: row.claimable,
    missions: row.missions,
    readAt: Date.now(),
  };
}

export async function getWallet(): Promise<Wallet> {
  await connection();
  return readWallet(await createSupabaseServerClient());
}
