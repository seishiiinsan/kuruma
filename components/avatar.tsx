import Image from "next/image";
import Link from "next/link";
import type { PlayerRef } from "@/lib/game";

const FALLBACK_COLORS = ["#3d8bff", "#9b4dff", "#e08a00", "#e3262f", "#0fa89c", "#d94a7a"];

/** Discord avatars accept a size; ask for 2x the rendered size. */
function sized(url: string, size: number) {
  if (!url.startsWith("https://cdn.discordapp.com/")) return url;
  const target = [16, 32, 64, 128, 256, 512].find((s) => s >= size * 2) ?? 512;
  const u = new URL(url);
  u.searchParams.set("size", String(target));
  return u.toString();
}

/** A player's Discord picture, or their initials when they have none. */
export function Avatar({
  player,
  size = 40,
  className = "",
}: {
  player: Pick<PlayerRef, "name" | "avatarUrl">;
  size?: number;
  className?: string;
}) {
  if (player.avatarUrl) {
    return (
      <Image
        src={sized(player.avatarUrl, size)}
        alt=""
        width={size}
        height={size}
        unoptimized
        className={`shrink-0 rounded-full bg-surface-lo object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const hash = [...player.name].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const initials = player.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: FALLBACK_COLORS[hash % FALLBACK_COLORS.length],
      }}
    >
      {initials}
    </span>
  );
}

/** Avatar + name, linking to the player's profile. */
export function PlayerChip({
  player,
  size = 32,
  detail,
}: {
  player: PlayerRef;
  size?: number;
  detail?: React.ReactNode;
}) {
  return (
    <Link
      href={`/joueur/${player.handle}`}
      className="group flex min-w-0 items-center gap-3"
    >
      <Avatar player={player} size={size} />
      <span className="min-w-0">
        <span className="block truncate font-extrabold underline-offset-4 group-hover:underline">
          {player.name}
        </span>
        {detail && <span className="block truncate text-sm text-muted">{detail}</span>}
      </span>
    </Link>
  );
}
