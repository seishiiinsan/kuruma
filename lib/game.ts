import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cardBySlug } from "./catalog";
import { asFinish, byRarity, toFace, type CardFace, type Finish } from "./cards";
import { toLook, type Look } from "./cosmetics";
import { toPermit, type Permit } from "./permit";
import { toAccount, type Account } from "./trust";

/** A public player, as shown next to anything they did. */
export type PlayerRef = {
  id: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
  /** Title, badges, frame and banner they wear; absent when not fetched. */
  look?: Look;
};

/** One numbered copy of a card, with its face for rendering. */
export type Copy = {
  id: string;
  serial: number;
  finish: Finish;
  obtainedAt: string;
  card: CardFace;
};

const client = cache(async () => {
  // Every read depends on the signed-in session, so never prerender it.
  await connection();
  return createSupabaseServerClient();
});

const toPlayer = (p: {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  title_id: string | null;
  frame_id: string | null;
  banner_id: string | null;
  badge_ids: string[] | null;
}): PlayerRef => ({
  id: p.id,
  handle: p.handle,
  name: p.display_name ?? "Collectionneur",
  avatarUrl: p.avatar_url,
  look: toLook(p),
});

function toCopy(row: {
  id: string;
  card_slug: string;
  serial: number;
  finish: string;
  obtained_at: string;
}): Copy | null {
  const card = cardBySlug(row.card_slug);
  return card
    ? {
        id: row.id,
        serial: row.serial,
        finish: asFinish(row.finish),
        obtainedAt: row.obtained_at,
        card: toFace(card),
      }
    : null;
}

const isCopy = (c: Copy | null): c is Copy => c !== null;

/* ---------- Viewer ---------- */

export type Viewer = PlayerRef & {
  email: string | null;
  memberSince: string;
};

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await client();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, handle, display_name, avatar_url, created_at, title_id, frame_id, banner_id, badge_ids")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;

  return {
    ...toPlayer(profile),
    email: user.email ?? null,
    memberSince: profile.created_at,
  };
});

/** The viewer's standing: onboarding, ban, trade restrictions. */
export const getAccount = cache(async (): Promise<Account | null> => {
  const supabase = await client();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return null;
  const { data } = await supabase.rpc("my_account");
  return toAccount(data);
});

/* ---------- Players ---------- */

export async function getPlayerByHandle(handle: string) {
  const supabase = await client();
  const { data } = await supabase
    .from("profiles")
    .select("id, handle, display_name, avatar_url, created_at, title_id, frame_id, banner_id, badge_ids, permit_level")
    .eq("handle", handle)
    .maybeSingle();
  return data ? { ...toPlayer(data), memberSince: data.created_at, level: data.permit_level } : null;
}

/** The signed-in player's permit, after catching up with what they just did. */
export async function getMyPermit(): Promise<Permit | null> {
  const supabase = await client();
  const { data } = await supabase.rpc("my_permit");
  const permit = data as { level?: number; xp?: number } | null;
  return permit?.level ? toPermit(permit.level, permit.xp ?? 0) : null;
}

export async function getPlayersByIds(ids: string[]): Promise<Map<string, PlayerRef>> {
  if (ids.length === 0) return new Map();
  const supabase = await client();
  const { data } = await supabase
    .from("profiles")
    .select("id, handle, display_name, avatar_url, title_id, frame_id, banner_id, badge_ids")
    .in("id", [...new Set(ids)]);
  return new Map((data ?? []).map((p) => [p.id, toPlayer(p)]));
}

/* ---------- Copies ---------- */

export async function getCopiesOf(userId: string): Promise<Copy[]> {
  const supabase = await client();
  const { data } = await supabase
    .from("card_copies")
    .select("id, card_slug, serial, finish, obtained_at")
    .eq("owner_id", userId)
    .order("obtained_at", { ascending: false });
  return (data ?? []).map(toCopy).filter(isCopy);
}

export async function getCardCirculation(slug: string) {
  const supabase = await client();
  const [{ data: card }, { data: copies }] = await Promise.all([
    supabase.from("cards").select("minted, supply").eq("slug", slug).maybeSingle(),
    supabase.from("card_copies").select("id, serial, finish, owner_id, obtained_at").eq("card_slug", slug).order("serial"),
  ]);
  const owners = await getPlayersByIds((copies ?? []).flatMap((c) => (c.owner_id ? [c.owner_id] : [])));
  return {
    minted: card?.minted ?? 0,
    copies: (copies ?? []).map((c) => ({
      id: c.id,
      serial: c.serial,
      finish: asFinish(c.finish),
      obtainedAt: c.obtained_at,
      owner: c.owner_id ? (owners.get(c.owner_id) ?? null) : null,
      /** Sold back to the shop, waiting for a buyer. */
      inShop: c.owner_id === null,
    })),
  };
}

export type HistoryVia = "pack" | "trade" | "shop" | "market";

/** One owner of a copy, in the order it changed hands. */
export type CopyOwner = {
  /** null when that player deleted their account. */
  player: PlayerRef | null;
  via: HistoryVia;
  at: string;
  /** What they paid on the player market. */
  price: number | null;
};

/** One numbered copy with everyone who held it, first owner first. */
export async function getCopyProvenance(slug: string, serial: number) {
  const supabase = await client();
  const { data: copy } = await supabase
    .from("card_copies")
    .select("id, serial, finish, owner_id, obtained_at")
    .eq("card_slug", slug)
    .eq("serial", serial)
    .maybeSingle();
  if (!copy) return null;

  const [{ data: rows }, { data: sales }, { data: listing }] = await Promise.all([
    supabase.from("copy_history").select("owner_id, via, at").eq("copy_id", copy.id).order("at").order("id"),
    supabase.from("market_sales").select("buyer_id, price, sold_at").eq("copy_id", copy.id),
    supabase.from("market_listings").select("seller_id, price").eq("copy_id", copy.id).maybeSingle(),
  ]);
  const players = await getPlayersByIds((rows ?? []).flatMap((r) => (r.owner_id ? [r.owner_id] : [])));

  const owners: CopyOwner[] = (rows ?? []).map((r) => {
    // The sale recorded closest to the change of hands.
    const sale =
      r.via === "market"
        ? (sales ?? [])
            .filter((s) => s.buyer_id === r.owner_id)
            .sort((a, b) => Math.abs(Date.parse(a.sold_at) - Date.parse(r.at)) - Math.abs(Date.parse(b.sold_at) - Date.parse(r.at)))[0]
        : undefined;
    return {
      player: r.owner_id ? (players.get(r.owner_id) ?? null) : null,
      via: r.via as HistoryVia,
      at: r.at,
      price: sale?.price ?? null,
    };
  });

  return {
    id: copy.id,
    serial: copy.serial,
    finish: asFinish(copy.finish),
    owners,
    /** Nobody holds it right now: listed on the market or in the shop. */
    status: copy.owner_id ? ("owned" as const) : listing ? ("market" as const) : ("shop" as const),
    listingPrice: listing?.price ?? null,
  };
}

/** Car slugs the player owns at least one copy of. */
export async function getOwnedSlugs(userId: string): Promise<Set<string>> {
  const supabase = await client();
  const { data } = await supabase.from("card_copies").select("card_slug").eq("owner_id", userId);
  return new Set((data ?? []).map((row) => row.card_slug));
}

/* ---------- Wishlist ---------- */

export const MAX_WISHES = 60;

/** Cars the player looks for, latest first. */
export async function getWishes(userId: string): Promise<CardFace[]> {
  const supabase = await client();
  const { data } = await supabase
    .from("wishes")
    .select("card_slug")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []).flatMap((w) => {
    const card = cardBySlug(w.card_slug);
    return card ? [toFace(card)] : [];
  });
}

export async function isWished(userId: string, slug: string): Promise<boolean> {
  const supabase = await client();
  const { count } = await supabase
    .from("wishes")
    .select("card_slug", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("card_slug", slug);
  return (count ?? 0) > 0;
}

/**
 * Where each wished car can be had now: copies for sale second-hand, and
 * players holding a duplicate (asking them for a trade costs them nothing).
 */
export async function getWishLeads(slugs: string[]): Promise<Map<string, { used: number; doubles: number }>> {
  const leads = new Map(slugs.map((slug) => [slug, { used: 0, doubles: 0 }]));
  if (slugs.length === 0) return leads;
  const supabase = await client();
  const { data } = await supabase.from("card_copies").select("card_slug, owner_id").in("card_slug", slugs);
  const perOwner = new Map<string, number>();
  for (const copy of data ?? []) {
    const lead = leads.get(copy.card_slug)!;
    if (copy.owner_id === null) lead.used += 1;
    else {
      const key = `${copy.card_slug}:${copy.owner_id}`;
      const n = (perOwner.get(key) ?? 0) + 1;
      perOwner.set(key, n);
      if (n === 2) lead.doubles += 1;
    }
  }
  return leads;
}

/* ---------- Series ---------- */

/** Series the player has claimed, by id, with the claim date. */
export async function getClaims(userId: string): Promise<Map<string, string>> {
  const supabase = await client();
  const { data } = await supabase
    .from("series_claims")
    .select("series_id, claimed_at")
    .eq("user_id", userId);
  return new Map((data ?? []).map((row) => [row.series_id, row.claimed_at]));
}

/** How many distinct players own each of these cars. */
export async function getOwnerCounts(slugs: string[]): Promise<Map<string, number>> {
  if (slugs.length === 0) return new Map();
  const supabase = await client();
  const { data } = await supabase.from("card_copies").select("card_slug, owner_id").in("card_slug", slugs);
  const owners = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    if (!row.owner_id) continue;
    owners.set(row.card_slug, (owners.get(row.card_slug) ?? new Set()).add(row.owner_id));
  }
  return new Map([...owners].map(([slug, set]) => [slug, set.size]));
}

/* ---------- Garage ---------- */

export async function getGarage(userId: string): Promise<Copy[]> {
  const supabase = await client();
  const { data } = await supabase
    .from("garage_slots")
    .select("position, card_copies (id, card_slug, serial, finish, obtained_at)")
    .eq("user_id", userId)
    .order("position");
  return (data ?? [])
    .map((slot) => (slot.card_copies ? toCopy(slot.card_copies) : null))
    .filter(isCopy);
}

/* ---------- Leaderboard ---------- */

export type Standing = PlayerRef & {
  rank: number;
  score: number;
  distinctCards: number;
  copies: number;
  series: number;
};

export async function getLeaderboard(limit = 50): Promise<Standing[]> {
  const supabase = await client();
  const { data } = await supabase.rpc("leaderboard", { p_limit: limit });
  const looks = await getPlayersByIds((data ?? []).map((row) => row.user_id));
  return (data ?? []).map((row) => ({
    id: row.user_id,
    handle: row.handle,
    name: row.display_name ?? "Collectionneur",
    avatarUrl: row.avatar_url,
    look: looks.get(row.user_id)?.look,
    rank: Number(row.rank),
    score: Number(row.score),
    distinctCards: Number(row.distinct_cards),
    copies: Number(row.copies),
    series: Number(row.series),
  }));
}

/* ---------- Trades ---------- */

export type TradeStatus = "pending" | "accepted" | "declined" | "cancelled" | "expired" | "reverted";

export type Trade = {
  id: string;
  status: TradeStatus;
  createdAt: string;
  resolvedAt: string | null;
  /** True when the viewer made the offer. */
  outgoing: boolean;
  other: PlayerRef;
  /** What the viewer hands over and gets back, from the viewer's side. */
  give: Copy[];
  get: Copy[];
};

export async function getTrades(viewerId: string): Promise<Trade[]> {
  const supabase = await client();
  const { data } = await supabase
    .from("trades")
    .select(
      "id, from_id, to_id, status, created_at, resolved_at, trade_items (side, card_copies (id, card_slug, serial, finish, obtained_at))",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = data ?? [];
  const players = await getPlayersByIds(rows.flatMap((t) => [t.from_id, t.to_id]));

  return rows.flatMap((t) => {
    const outgoing = t.from_id === viewerId;
    const other = players.get(outgoing ? t.to_id : t.from_id);
    if (!other) return [];
    const side = (s: "give" | "take") =>
      t.trade_items
        .filter((i) => i.side === s && i.card_copies)
        .map((i) => toCopy(i.card_copies!))
        .filter(isCopy)
        .sort((a, b) => byRarity(a.card, b.card));
    return [
      {
        id: t.id,
        status: t.status as TradeStatus,
        createdAt: t.created_at,
        resolvedAt: t.resolved_at,
        outgoing,
        other,
        give: outgoing ? side("give") : side("take"),
        get: outgoing ? side("take") : side("give"),
      },
    ];
  });
}

/* ---------- Notifications ---------- */

export type NotificationKind =
  | "trade_received"
  | "trade_accepted"
  | "trade_declined"
  | "trade_cancelled"
  | "wish_shop"
  | "wish_used"
  | "wish_double"
  | "wish_market"
  | "market_sold"
  | "market_expired"
  | "moderation"
  | "permit_up";

export type Notification = {
  id: string;
  kind: NotificationKind;
  actor: PlayerRef | null;
  /** The wished car, for wishlist alerts. */
  card: { slug: string; name: string } | null;
  /** The level reached, for permit_up. */
  level: number | null;
  createdAt: string;
  unread: boolean;
};

export async function getNotifications(limit = 12): Promise<Notification[]> {
  const supabase = await client();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, actor_id, card_slug, level, created_at, read_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  const rows = data ?? [];
  const actors = await getPlayersByIds(rows.flatMap((n) => (n.actor_id ? [n.actor_id] : [])));
  return rows.map((n) => {
    const card = n.card_slug ? cardBySlug(n.card_slug) : undefined;
    return {
      id: n.id,
      kind: n.kind as NotificationKind,
      actor: n.actor_id ? (actors.get(n.actor_id) ?? null) : null,
      card: card ? { slug: card.slug, name: card.name } : null,
      level: n.level,
      createdAt: n.created_at,
      unread: n.read_at === null,
    };
  });
}
