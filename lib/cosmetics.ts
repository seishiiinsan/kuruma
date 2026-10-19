import type { CardTier } from "./cards";
import type { Metric } from "./economy";

/**
 * Profile cosmetics: a title under the name, up to three badges, a frame
 * around the avatar and a banner behind the profile. Each one is either
 * unlocked by playing (a metric of public.player_metrics reaching a goal) or
 * bought with jetons, never both. Unlocks stay for good, even if the metric
 * drops later (cards sold, garage emptied).
 *
 * Every id, price and goal here must match
 * supabase/migrations/*_profile_cosmetics.sql.
 */

export type CosmeticKind = "title" | "badge" | "frame" | "banner";

export type Unlock = { metric: Metric; goal: number } | { price: number };

export type BadgeIcon =
  | "package"
  | "gem"
  | "crown"
  | "handshake"
  | "book"
  | "hash"
  | "flame"
  | "warehouse"
  | "bag"
  | "globe"
  | "trophy"
  | "flag"
  | "wrench"
  | "gauge"
  | "fuel"
  | "zap"
  | "rocket"
  | "star";

export type Cosmetic = {
  id: string;
  kind: CosmeticKind;
  name: string;
  /** Drives the colour of its chip, like a card. */
  tier: CardTier;
  unlock: Unlock;
  /** Badges only. */
  icon?: BadgeIcon;
  /** Frames and banners: a CSS background. */
  paint?: string;
};

export const MAX_BADGES = 3;

export const KINDS: { kind: CosmeticKind; label: string; plural: string; hint: string }[] = [
  { kind: "title", label: "Titre", plural: "Titres", hint: "Affiché sous ton nom, sur ton profil et au classement." },
  { kind: "badge", label: "Badge", plural: "Badges", hint: `Jusqu'à ${MAX_BADGES} badges à côté de ton nom.` },
  { kind: "frame", label: "Cadre", plural: "Cadres", hint: "Le contour de ton avatar, partout où il apparaît." },
  { kind: "banner", label: "Bannière", plural: "Bannières", hint: "Le fond de ton profil." },
];

const t = (id: string, name: string, tier: CardTier, unlock: Unlock): Cosmetic => ({ id: `title-${id}`, kind: "title", name, tier, unlock });
const b = (id: string, name: string, tier: CardTier, icon: BadgeIcon, unlock: Unlock): Cosmetic => ({
  id: `badge-${id}`,
  kind: "badge",
  name,
  tier,
  icon,
  unlock,
});
const f = (id: string, name: string, tier: CardTier, paint: string, unlock: Unlock): Cosmetic => ({
  id: `frame-${id}`,
  kind: "frame",
  name,
  tier,
  paint,
  unlock,
});
const n = (id: string, name: string, tier: CardTier, paint: string, unlock: Unlock): Cosmetic => ({
  id: `banner-${id}`,
  kind: "banner",
  name,
  tier,
  paint,
  unlock,
});

export const COSMETICS: Cosmetic[] = [
  /* ---------- Titles ---------- */
  t("premier-pack", "Apprenti collectionneur", "common", { metric: "packs", goal: 1 }),
  t("dechireur", "Déchireur de packs", "rare", { metric: "packs", goal: 100 }),
  t("collectionneur", "Collectionneur", "rare", { metric: "cards", goal: 100 }),
  t("conservateur", "Conservateur de musée", "legendary", { metric: "cards", goal: 1000 }),
  t("legende", "Touché par la légende", "epic", { metric: "legendaries", goal: 1 }),
  t("mythe", "Mythe vivant", "legendary", { metric: "legendaries", goal: 25 }),
  t("troc", "Roi du troc", "epic", { metric: "trades", goal: 15 }),
  t("archiviste", "Archiviste", "epic", { metric: "series", goal: 10 }),
  t("globe-trotter", "Globe-trotter", "rare", { metric: "cultures", goal: 8 }),
  t("premiere-main", "Première main", "rare", { metric: "serials", goal: 10 }),
  t("habitue", "Habitué du paddock", "rare", { metric: "days", goal: 30 }),
  t("pilier", "Pilier du garage", "legendary", { metric: "days", goal: 365 }),
  t("pilote-usine", "Pilote d'usine", "legendary", { metric: "score", goal: 50000 }),
  t("ferrailleur", "Ferrailleur", "common", { metric: "sold", goal: 100 }),
  t("dimanche", "Pilote du dimanche", "common", { price: 150 }),
  t("circuit", "Habitué des track days", "rare", { price: 400 }),
  t("drift", "Roi du drift", "rare", { price: 800 }),
  t("gentleman", "Gentleman driver", "epic", { price: 1500 }),
  t("chef-ecurie", "Chef d'écurie", "legendary", { price: 4000 }),

  /* ---------- Badges ---------- */
  b("premier-pack", "Premier pack", "common", "package", { metric: "packs", goal: 1 }),
  b("epiques", "Chasseur d'épiques", "rare", "gem", { metric: "epics", goal: 5 }),
  b("legende", "Légende en poche", "epic", "crown", { metric: "legendaries", goal: 1 }),
  b("echange", "Poignée de main", "common", "handshake", { metric: "trades", goal: 1 }),
  b("album", "Album complet", "rare", "book", { metric: "series", goal: 1 }),
  b("numero-un", "Nº 1", "rare", "hash", { metric: "serials", goal: 1 }),
  b("semaine", "Une semaine d'affilée", "common", "flame", { metric: "days", goal: 7 }),
  b("garage", "Garage plein", "common", "warehouse", { metric: "garage", goal: 6 }),
  b("client", "Client fidèle", "rare", "bag", { metric: "bought", goal: 10 }),
  b("monde", "Tour du monde", "rare", "globe", { metric: "cultures", goal: 5 }),
  b("podium", "Grosse cote", "epic", "trophy", { metric: "score", goal: 20000 }),
  b("cle", "Clé de 12", "common", "wrench", { price: 250 }),
  b("jauge", "Compte-tours", "common", "gauge", { price: 300 }),
  b("plein", "Plein de super", "rare", "fuel", { price: 450 }),
  b("damier", "Drapeau à damier", "rare", "flag", { price: 600 }),
  b("eclair", "Éclair", "epic", "zap", { price: 900 }),
  b("fusee", "Launch control", "epic", "rocket", { price: 1400 }),
  b("etoile", "Étoile filante", "legendary", "star", { price: 3000 }),

  /* ---------- Avatar frames ---------- */
  f("bronze", "Bronze", "common", "conic-gradient(from 210deg, #f0a061, #a9561b, #f6c08d, #a9561b, #f0a061)", { metric: "cards", goal: 25 }),
  f("argent", "Argent", "rare", "conic-gradient(from 210deg, #f4f6ff, #8d94b3, #ffffff, #8d94b3, #f4f6ff)", { metric: "series", goal: 3 }),
  f("or", "Or légendaire", "legendary", "conic-gradient(from 210deg, #ffe066, #c98200, #fff3b0, #c98200, #ffe066)", { metric: "legendaries", goal: 10 }),
  f("violet", "Améthyste", "epic", "conic-gradient(from 0deg, #c77dff, #6b2bd9, #e9c8ff, #6b2bd9, #c77dff)", { metric: "epics", goal: 40 }),
  f("carbone", "Carbone", "common", "repeating-conic-gradient(#2a2a33 0 25%, #4a4a57 0 50%) 0 0 / 8px 8px", { price: 500 }),
  f("damier", "Damier", "rare", "repeating-conic-gradient(#ffffff 0 25%, #111111 0 50%) 0 0 / 10px 10px", { price: 900 }),
  f("neon", "Néon", "epic", "conic-gradient(from 90deg, #00f0ff, #ff2bd6, #00f0ff, #ff2bd6, #00f0ff)", { price: 1200 }),
  f("holo", "Holographique", "legendary", "conic-gradient(from 0deg, #ff6b6b, #ffd93d, #6bff95, #4fb0ff, #c77dff, #ff6b6b)", { price: 2500 }),

  /* ---------- Profile banners ---------- */
  n("bitume", "Bitume", "common", "repeating-linear-gradient(100deg, transparent 0 38px, rgb(255 204 51 / 0.18) 38px 46px), linear-gradient(160deg, #3a3550 0%, #1c1a28 70%)", { metric: "cards", goal: 250 }),
  n("aube", "Départ à l'aube", "rare", "linear-gradient(170deg, #ff9a62 0%, #c2457a 45%, #2b2380 100%)", { metric: "days", goal: 100 }),
  n("paddock", "Paddock", "epic", "radial-gradient(circle at 80% 10%, rgb(47 210 122 / 0.55), transparent 55%), linear-gradient(160deg, #0f3d2b, #120c3c 70%)", { metric: "trades", goal: 40 }),
  n("route-66", "Route 66", "rare", "linear-gradient(180deg, #ffb347 0%, #ff6f3c 40%, #7a2c55 75%, #2b1640 100%)", { price: 800 }),
  n("tokyo", "Néons de Tokyo", "epic", "radial-gradient(circle at 15% 20%, rgb(255 43 214 / 0.55), transparent 50%), radial-gradient(circle at 85% 80%, rgb(0 240 255 / 0.45), transparent 50%), linear-gradient(160deg, #1a0b3d, #07041a)", { price: 1000 }),
  n("ring", "Nordschleife", "epic", "radial-gradient(ellipse at 50% 120%, rgb(47 210 122 / 0.4), transparent 60%), linear-gradient(170deg, #4b6b8a 0%, #1f3346 55%, #0b1520 100%)", { price: 1500 }),
  n("aurore", "Aurore boréale", "legendary", "radial-gradient(ellipse at 30% 0%, rgb(107 255 149 / 0.55), transparent 55%), radial-gradient(ellipse at 75% 10%, rgb(199 125 255 / 0.5), transparent 55%), linear-gradient(180deg, #0a1f3a, #050816)", { price: 2000 }),
];

export const cosmeticById = (id: string | null | undefined) => (id ? COSMETICS.find((c) => c.id === id) : undefined);

export const isBought = (c: Cosmetic): c is Cosmetic & { unlock: { price: number } } => "price" in c.unlock;

/** What a player wears, as stored on public.profiles. */
export type Look = {
  titleId: string | null;
  frameId: string | null;
  bannerId: string | null;
  badgeIds: string[];
};

export const EMPTY_LOOK: Look = { titleId: null, frameId: null, bannerId: null, badgeIds: [] };

/** The profile columns behind a Look, for selects. */
export const LOOK_COLUMNS = "title_id, frame_id, banner_id, badge_ids";

export const toLook = (p: {
  title_id: string | null;
  frame_id: string | null;
  banner_id: string | null;
  badge_ids: string[] | null;
}): Look => ({
  titleId: p.title_id,
  frameId: p.frame_id,
  bannerId: p.banner_id,
  badgeIds: p.badge_ids ?? [],
});
