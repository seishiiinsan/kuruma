import "server-only";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** One player as moderators see them, from public.admin_player. */
export type AdminPlayer = {
  id: string;
  handle: string;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  discord_id: string | null;
  discord_created_at: string | null;
  banned_until: string | null;
  ban_reason: string | null;
  trade_block: string | null;
  coins: number;
  bonus: number;
  copies: number;
  packs: number;
  trades: {
    id: string;
    status: string;
    created_at: string;
    resolved_at: string | null;
    outgoing: boolean;
    partner_handle: string | null;
    partner_name: string | null;
    partner_young: boolean;
    items: { slug: string; serial: number; side: "give" | "take" }[];
  }[];
  sales: {
    id: number;
    card_slug: string;
    price: number;
    fee: number;
    sold_at: string;
    reverted_at: string | null;
    sold: boolean;
    partner_handle: string | null;
    partner_name: string | null;
  }[];
  ledger: { amount: number; reason: string; ref: string | null; created_at: string }[];
  reports: { id: string; reason: string; details: string | null; status: string; created_at: string; reporter_handle: string }[];
  log: { action: string; detail: Record<string, unknown>; created_at: string; admin_handle: string | null }[];
};

async function client() {
  await connection();
  return createSupabaseServerClient();
}

export async function isAdmin() {
  const supabase = await client();
  const { data } = await supabase.rpc("is_admin");
  return data === true;
}

export async function getReports(status: "open" | "resolved" | "dismissed" = "open") {
  const supabase = await client();
  const { data } = await supabase.rpc("admin_reports", { p_status: status });
  return data ?? [];
}

export async function getAdminPlayer(handle: string) {
  const supabase = await client();
  const { data } = await supabase.rpc("admin_player", { p_handle: handle });
  return (data as AdminPlayer | null) ?? null;
}

export async function getSuspects() {
  const supabase = await client();
  const { data } = await supabase.rpc("admin_suspects");
  return data ?? [];
}
