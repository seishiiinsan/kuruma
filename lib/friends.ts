import "server-only";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPlayersByIds, type PlayerRef } from "./game";

/**
 * Friends: a player asks, the other accepts (public.add_friend). The trade
 * page lists friends only; any profile still offers a trade.
 */

/** Where the viewer stands with another player. */
export type Friendship = "none" | "sent" | "received" | "friends";

type Row = { requester_id: string; addressee_id: string; status: string };

async function rows(): Promise<Row[]> {
  await connection();
  const supabase = await createSupabaseServerClient();
  // RLS only returns the viewer's own friendships.
  const { data } = await supabase.from("friendships").select("requester_id, addressee_id, status");
  return data ?? [];
}

export async function getFriendship(viewerId: string, otherId: string): Promise<Friendship> {
  const row = (await rows()).find((r) => [r.requester_id, r.addressee_id].includes(otherId));
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  return row.requester_id === viewerId ? "sent" : "received";
}

/** The viewer's friends, and the players waiting for an answer. */
export async function getFriends(viewerId: string): Promise<{ friends: PlayerRef[]; received: PlayerRef[] }> {
  const all = await rows();
  const other = (r: Row) => (r.requester_id === viewerId ? r.addressee_id : r.requester_id);
  const friendIds = all.filter((r) => r.status === "accepted").map(other);
  const receivedIds = all.filter((r) => r.status === "pending" && r.addressee_id === viewerId).map(other);
  const players = await getPlayersByIds([...friendIds, ...receivedIds]);
  const pick = (ids: string[]) =>
    ids.flatMap((id) => players.get(id) ?? []).sort((a, b) => a.name.localeCompare(b.name, "fr"));
  return { friends: pick(friendIds), received: pick(receivedIds) };
}
