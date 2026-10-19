import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheLife } from "next/cache";
import sharp from "sharp";
import { TIERS, formatSerial, formatSupply, type CardFace, type CardTier } from "./cards";

/* Share previews (Open Graph) drawn with next/og. Satori has no CSS variables
   and no WebP, so colours are spelled out and photos go through sharp. */

export const OG_SIZE = { width: 1200, height: 630 };

export const C = {
  bg: "#1d1656",
  bgDeep: "#120c3c",
  surface: "#2b2380",
  ink: "#ffffff",
  muted: "#bdb6ee",
  accent: "#ffcc33",
  accentEdge: "#d48a00",
  accentInk: "#3b1f00",
  cardInk: "#1a1442",
  cardMuted: "#5e5a86",
  cardLine: "#e3e0f3",
};

export const TIER_HEX: Record<CardTier, string> = {
  common: "#a9b1cf",
  rare: "#4fb0ff",
  epic: "#c77dff",
  legendary: "#ffbf2e",
};

const FRAME: Record<CardTier, string> = {
  common: "linear-gradient(145deg, #f4f5fb, #c8cde0 50%, #eef0f7)",
  rare: "linear-gradient(145deg, #a8dcff, #2f8fff 48%, #c4e8ff)",
  epic: "linear-gradient(145deg, #ecc9ff, #9b4dff 48%, #f3dcff)",
  legendary: "linear-gradient(145deg, #ffe59a, #e9a90c 35%, #fff3c4 62%, #d39400)",
};

const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));

let fonts: Promise<{ name: string; data: Buffer; weight: 400 | 800; style: "normal" }[]> | null = null;

/** Russo One for titles, Nunito for the rest, as on the site. */
export function ogFonts() {
  fonts ??= Promise.all([font("RussoOne-Regular.ttf"), font("Nunito-ExtraBold.ttf")]).then(
    ([russo, nunito]) => [
      { name: "Russo One", data: russo, weight: 400, style: "normal" },
      { name: "Nunito", data: nunito, weight: 800, style: "normal" },
    ],
  );
  return fonts;
}

/** A remote photo as a JPEG data URL Satori can draw, or null if it can't be fetched. */
export async function photoData(url: string | null, width: number): Promise<string | null> {
  "use cache";
  cacheLife("days");
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const jpeg = await sharp(Buffer.from(await res.arrayBuffer()))
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Rarity diamonds as rotated squares (Satori drops the small inline SVGs). */
export function Diamonds({ tier, size }: { tier: CardTier; size: number }) {
  const side = size * 0.72;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.32, height: size }}>
      {Array.from({ length: TIERS[tier].diamonds }, (_, i) => (
        <div
          key={i}
          style={{
            width: side,
            height: side,
            margin: `0 ${(size - side) / 2}px`,
            borderRadius: side * 0.12,
            background: TIER_HEX[tier],
            border: `${Math.max(1, size / 12)}px solid rgba(10,6,40,0.35)`,
            transform: "rotate(45deg)",
          }}
        />
      ))}
    </div>
  );
}

/** The trading card face, drawn at a given width (5:7). */
export function OgCard({
  card,
  photo,
  width,
  serial,
  rotate = 0,
}: {
  card: CardFace;
  photo: string | null;
  width: number;
  serial?: number;
  rotate?: number;
}) {
  const u = width / 100;
  return (
    <div
      style={{
        display: "flex",
        width,
        height: width * 1.4,
        padding: 1.6 * u,
        borderRadius: 4.5 * u,
        background: FRAME[card.tier],
        boxShadow: "0 18px 40px rgba(6,3,30,0.55)",
        // Satori rejects `transform: undefined`.
        ...(rotate ? { transform: `rotate(${rotate}deg)` } : {}),
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          overflow: "hidden",
          borderRadius: 3.2 * u,
          background: "#ffffff",
          color: C.cardInk,
          fontFamily: "Nunito",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: 19 * u,
            padding: `${2 * u}px ${5.5 * u}px`,
            fontSize: 6.4 * u,
            lineHeight: 1.15,
            letterSpacing: -0.01 * 6.4 * u,
          }}
        >
          <span style={{ display: "block", lineClamp: 2 }}>{card.name}</span>
        </div>
        <div
          style={{
            display: "flex",
            margin: `0 ${3 * u}px`,
            height: 85 * u,
            borderRadius: 2.2 * u,
            overflow: "hidden",
            background: C.cardLine,
          }}
        >
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" width={94 * u} height={85 * u} style={{ objectFit: "cover" }} />
          )}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            justifyContent: "space-around",
            padding: `0 ${4.5 * u}px`,
            fontSize: 4.6 * u,
          }}
        >
          {card.brand && <span style={{ color: C.cardMuted, padding: `0 ${u}px` }}>{card.brand}</span>}
          <div style={{ display: "flex", gap: 1.5 * u }}>
            {[card.culture, card.year, card.powerHp ? `${card.powerHp} ch` : null]
              .filter(Boolean)
              .map((stat) => (
                <span
                  key={String(stat)}
                  style={{ background: C.cardLine, borderRadius: 99, padding: `${0.8 * u}px ${2.5 * u}px` }}
                >
                  {stat}
                </span>
              ))}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${C.cardLine}`,
            padding: `${3.5 * u}px ${5.5 * u}px`,
            fontSize: 4.6 * u,
            color: C.cardMuted,
          }}
        >
          <Diamonds tier={card.tier} size={4 * u} />
          <span>
            {serial !== undefined
              ? formatSerial(serial, card.supply)
              : card.supply
                ? `${formatSupply(card.supply)} ex.`
                : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

/** The table every preview sits on: indigo, a warm glow, the wordmark. */
export function OgTable({ children, footer }: { children: React.ReactNode; footer?: string }) {
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        height: "100%",
        backgroundImage: `radial-gradient(circle at 12% 0%, rgba(255,191,46,0.2), rgba(255,191,46,0) 42%), linear-gradient(160deg, ${C.bg}, ${C.bgDeep})`,
        color: C.ink,
        fontFamily: "Nunito",
      }}
    >
      <div style={{ display: "flex", position: "relative", flex: 1, padding: "56px 64px" }}>{children}</div>
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          bottom: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 26,
          color: C.muted,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <Logo size={44} />
          <span style={{ fontFamily: "Russo One", fontSize: 34, color: C.ink }}>Kuruma</span>
        </div>
        {footer && <span>{footer}</span>}
      </div>
    </div>
  );
}

/** The app mark: a yellow card with a K, tilted like one just pulled from a pack. */
export function Logo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512">
      <g transform="rotate(-8 256 256)">
        <rect x="118" y="78" width="276" height="372" rx="44" fill={C.accentEdge} />
        <rect x="118" y="62" width="276" height="372" rx="44" fill={C.accent} />
        <path d={K_PATH} fill={C.bg} />
      </g>
    </svg>
  );
}

/** Same shape as public/icon.svg (scripts/icons/build-icons.mjs). */
const K_PATH = "M150 132h58v94l78-94h70l-90 104 96 122h-74l-80-102v102h-58z";
