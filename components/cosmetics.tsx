import {
  BookOpen,
  Crown,
  Flag,
  Flame,
  Fuel,
  Gauge,
  Gem,
  Globe,
  Handshake,
  Hash,
  Package,
  Rocket,
  ShoppingBag,
  Star,
  Trophy,
  Warehouse,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { TIERS } from "@/lib/cards";
import { cosmeticById, type BadgeIcon, type Cosmetic, type Look } from "@/lib/cosmetics";
import type { PlayerRef } from "@/lib/game";
import { Avatar } from "./avatar";

const BADGE_ICONS: Record<BadgeIcon, LucideIcon> = {
  package: Package,
  gem: Gem,
  crown: Crown,
  handshake: Handshake,
  book: BookOpen,
  hash: Hash,
  flame: Flame,
  warehouse: Warehouse,
  bag: ShoppingBag,
  globe: Globe,
  trophy: Trophy,
  flag: Flag,
  wrench: Wrench,
  gauge: Gauge,
  fuel: Fuel,
  zap: Zap,
  rocket: Rocket,
  star: Star,
};

/** The avatar inside the player's frame; a plain avatar (with `className`) when they wear none. */
export function FramedAvatar({
  player,
  look = player.look,
  size = 40,
  className = "",
}: {
  player: Pick<PlayerRef, "name" | "avatarUrl" | "look">;
  look?: Look;
  size?: number;
  className?: string;
}) {
  const frame = cosmeticById(look?.frameId);
  if (!frame?.paint) return <Avatar player={player} size={size} className={className} />;
  const ring = Math.max(2, Math.round(size * 0.07));
  return (
    <span
      className="inline-flex shrink-0 rounded-full shadow-[0_2px_6px_rgb(6_3_30/0.5)]"
      style={{ padding: ring, background: frame.paint }}
      title={`Cadre ${frame.name}`}
    >
      <Avatar player={player} size={size - ring * 2} className="ring-2 ring-bg-deep" />
    </span>
  );
}

/** The title a player wears, in its tier's colour. */
export function PlayerTitle({ look, className = "" }: { look?: Look; className?: string }) {
  const title = cosmeticById(look?.titleId);
  if (!title) return null;
  return (
    <span className={`font-extrabold ${className}`} style={{ color: TIERS[title.tier].color }}>
      {title.name}
    </span>
  );
}

/** A badge: its icon on a round chip, rimmed with its tier's colour. */
export function BadgeChip({ badge, size = 28 }: { badge: Cosmetic; size?: number }) {
  const Icon = badge.icon ? BADGE_ICONS[badge.icon] : Star;
  const color = TIERS[badge.tier].color;
  return (
    <span
      title={badge.name}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-bg-deep"
      style={{
        width: size,
        height: size,
        color,
        boxShadow: `inset 0 0 0 2px ${color}, 0 2px 0 rgb(6 3 30 / 0.5)`,
      }}
    >
      <Icon style={{ width: size * 0.52, height: size * 0.52 }} strokeWidth={2.4} aria-hidden />
      <span className="sr-only">{badge.name}</span>
    </span>
  );
}

export function BadgeRow({ look, size = 28, className = "" }: { look?: Look; size?: number; className?: string }) {
  const badges = (look?.badgeIds ?? []).flatMap((id) => cosmeticById(id) ?? []);
  if (badges.length === 0) return null;
  return (
    <ul className={`flex items-center gap-1.5 ${className}`} aria-label="Badges">
      {badges.map((badge) => (
        <li key={badge.id} className="flex">
          <BadgeChip badge={badge} size={size} />
        </li>
      ))}
    </ul>
  );
}

/** The banner's CSS background, or undefined for the default panel. */
export const bannerPaint = (look?: Look) => cosmeticById(look?.bannerId)?.paint;
