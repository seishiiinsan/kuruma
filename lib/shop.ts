import "server-only";
import { connection } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cardBySlug } from "./catalog";
import { TIER_ORDER, asFinish, byRarity, toFace, type CardFace, type CardTier } from "./cards";
import { ACHIEVEMENTS, type Metrics } from "./economy";
import { getPlayersByIds, type Copy, type PlayerRef } from "./game";
import type { HistoryPoint, Quote } from "./market";
import type { Mission, MissionKind } from "./missions";
import type { SalonBoard } from "./salons";

async function client() {
  await connection();
  return createSupabaseServerClient();
}

/* ---------- Window: new cards, same for everyone ---------- */

export type Offer = {
  period: string;
  slot: number;
  weekly: boolean;
  price: number;
  bought: boolean;
  soldOut: boolean;
  card: CardFace;
};

export async function getShopWindow(): Promise<Offer[]> {
  const supabase = await client();
  const { data } = await supabase.rpc("shop_window");
  return (data ?? []).flatMap((row) => {
    const card = cardBySlug(row.card_slug);
    return card
      ? [
          {
            period: row.period,
            slot: row.slot,
            weekly: row.period.includes("W"),
            price: row.price,
            bought: row.bought,
            soldOut: row.sold_out,
            card: toFace(card),
          },
        ]
      : [];
  });
}

/* ---------- Second-hand: copies players sold back ---------- */

export async function getUsedStock(limit = 200): Promise<Copy[]> {
  const supabase = await client();
  const { data } = await supabase
    .from("shop_stock")
    .select("listed_at, card_copies (id, card_slug, serial, finish)")
    .order("listed_at", { ascending: false })
    .limit(limit);
  return (data ?? []).flatMap((row) => {
    const copy = row.card_copies;
    const card = copy ? cardBySlug(copy.card_slug) : undefined;
    return copy && card ? [{ id: copy.id, serial: copy.serial, finish: asFinish(copy.finish), obtainedAt: row.listed_at, card: toFace(card) }] : [];
  });
}

/* ---------- Duplicates the player can sell ---------- */

export type Duplicates = Record<CardTier, Copy[]>;

/**
 * Copies the shop would buy: for each car, every copy but the one kept (the
 * one in the garage, else the lowest number), minus copies in the garage or
 * in a pending trade. Mirrors public.sell_duplicates.
 */
export async function getDuplicates(userId: string, copies: Copy[]): Promise<Duplicates> {
  const supabase = await client();
  const [{ data: garage }, { data: trades }] = await Promise.all([
    supabase.from("garage_slots").select("copy_id").eq("user_id", userId),
    supabase.from("trades").select("trade_items (copy_id)").eq("status", "pending"),
  ]);
  const inGarage = new Set((garage ?? []).map((g) => g.copy_id));
  const inTrade = new Set((trades ?? []).flatMap((t) => t.trade_items.map((i) => i.copy_id)));

  const byCar = new Map<string, Copy[]>();
  for (const copy of copies) byCar.set(copy.card.slug, [...(byCar.get(copy.card.slug) ?? []), copy]);

  const result = Object.fromEntries(TIER_ORDER.map((tier) => [tier, [] as Copy[]])) as Duplicates;
  for (const group of byCar.values()) {
    if (group.length < 2) continue;
    const [, ...extra] = [...group].sort(
      (a, b) =>
        Number(inGarage.has(b.id)) - Number(inGarage.has(a.id)) ||
        Number(inTrade.has(a.id)) - Number(inTrade.has(b.id)) ||
        a.serial - b.serial,
    );
    for (const copy of extra) {
      if (!inGarage.has(copy.id) && !inTrade.has(copy.id)) result[copy.card.tier].push(copy);
    }
  }
  for (const tier of TIER_ORDER) result[tier].sort((a, b) => byRarity(a.card, b.card) || a.card.name.localeCompare(b.card.name));
  return result;
}

/* ---------- Achievements ---------- */

export async function getMyAchievements(userId: string): Promise<{ metrics: Metrics; claimed: Set<string> }> {
  const supabase = await client();
  const [{ data: metrics }, { data: claims }] = await Promise.all([
    supabase.rpc("my_metrics"),
    supabase.from("achievement_claims").select("achievement_id").eq("user_id", userId),
  ]);
  const values = (metrics ?? {}) as Partial<Metrics>;
  return {
    metrics: Object.fromEntries(ACHIEVEMENTS.map((f) => [f.metric, Number(values[f.metric] ?? 0)])) as Metrics,
    claimed: new Set((claims ?? []).map((c) => c.achievement_id)),
  };
}

/* ---------- Missions ---------- */

export async function getMyMissions(): Promise<Mission[]> {
  const supabase = await client();
  const { data } = await supabase.rpc("my_missions");
  return (data ?? []).map((m) => ({
    id: m.mission_id,
    period: m.period,
    cadence: m.cadence as Mission["cadence"],
    kind: m.kind as MissionKind,
    param: m.param,
    goal: m.goal,
    reward: m.reward,
    progress: m.progress,
    claimed: m.claimed,
  }));
}

/* ---------- Auto shows: this week's challenges ---------- */

/** Null between shows. */
export async function getMySalon(): Promise<SalonBoard | null> {
  const supabase = await client();
  const { data } = await supabase.rpc("my_salon");
  const first = data?.[0];
  if (!first) return null;
  return {
    salonId: first.salon_id,
    period: first.period,
    finaleClaimed: first.finale_claimed,
    challenges: data.map((c) => ({
      ord: c.ord,
      kind: c.kind as MissionKind,
      param: c.param,
      goal: c.goal,
      reward: c.reward,
      progress: c.progress,
      claimed: c.claimed,
    })),
  };
}

/* ---------- Player market ---------- */

export type Listing = Copy & {
  price: number;
  seller: PlayerRef | null;
  expiresAt: string;
};

type ListingRow = {
  price: number;
  seller_id: string;
  expires_at: string;
  listed_at: string;
  card_copies: { id: string; card_slug: string; serial: number; finish: string } | null;
};

async function toListings(rows: ListingRow[]): Promise<Listing[]> {
  const sellers = await getPlayersByIds(rows.map((r) => r.seller_id));
  return rows.flatMap((row) => {
    const copy = row.card_copies;
    const card = copy ? cardBySlug(copy.card_slug) : undefined;
    return copy && card
      ? [
          {
            id: copy.id,
            serial: copy.serial,
            finish: asFinish(copy.finish),
            obtainedAt: row.listed_at,
            card: toFace(card),
            price: row.price,
            seller: sellers.get(row.seller_id) ?? null,
            expiresAt: row.expires_at,
          },
        ]
      : [];
  });
}

const LISTING_COLUMNS = "price, seller_id, expires_at, listed_at, card_copies (id, card_slug, serial, finish)";

/** Latest listings across the market, still on sale. */
export async function getMarketListings(limit = 120): Promise<Listing[]> {
  const supabase = await client();
  const { data } = await supabase
    .from("market_listings")
    .select(LISTING_COLUMNS)
    .gt("expires_at", new Date().toISOString())
    .order("listed_at", { ascending: false })
    .limit(limit);
  return toListings(data ?? []);
}

/** Listings of one car, cheapest first. */
export async function getListingsOf(slug: string): Promise<Listing[]> {
  const supabase = await client();
  const { data } = await supabase
    .from("market_listings")
    .select(LISTING_COLUMNS)
    .eq("card_slug", slug)
    .gt("expires_at", new Date().toISOString())
    .order("price")
    .limit(50);
  return toListings(data ?? []);
}

export async function getMyListings(userId: string): Promise<Listing[]> {
  const supabase = await client();
  const { data } = await supabase
    .from("market_listings")
    .select(LISTING_COLUMNS)
    .eq("seller_id", userId)
    .order("listed_at", { ascending: false });
  return toListings(data ?? []);
}

export async function getQuote(slug: string): Promise<Quote | null> {
  const supabase = await client();
  const { data } = await supabase.rpc("market_quote", { p_slug: slug });
  const row = data?.[0];
  return row
    ? {
        reference: row.reference,
        min: row.min_price,
        max: row.max_price,
        sales: row.sales,
        base: row.base,
        tierPrice: row.tier_price,
        scarcity: row.scarcity,
        exhaustion: row.exhaustion,
        demand: row.demand,
        offer: row.offer,
        marketMedian: row.market_median,
      }
    : null;
}

export async function getHistory(slug: string, days = 90): Promise<HistoryPoint[]> {
  const supabase = await client();
  const { data } = await supabase.rpc("market_history", { p_slug: slug, p_days: days });
  return (data ?? []).map((d) => ({ day: d.day, median: d.median, low: d.low, high: d.high, sales: d.sales }));
}
