import { ImageResponse } from "next/og";
import { cacheLife } from "next/cache";
import { CATALOGUE_SIZE, cardBySlug } from "@/lib/catalog";
import { byRarity, formatInt, toFace, type CardFace } from "@/lib/cards";
import { C, OG_SIZE, OgCard, OgTable, ogFonts, photoData } from "@/lib/og";
import { supabasePublic } from "@/lib/supabase/public";

export const alt = "Profil d'un collectionneur Kuruma";
export const size = OG_SIZE;
export const contentType = "image/png";

/** Who they are, where they stand, and the three cards to show off. */
async function profileCard(handle: string) {
  "use cache";
  cacheLife("hours");
  const supabase = supabasePublic();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, handle, display_name, avatar_url")
    .eq("handle", handle)
    .maybeSingle();
  if (!profile) return null;

  const [{ data: board }, { data: garage }, { data: copies }] = await Promise.all([
    supabase.rpc("leaderboard", { p_limit: 1000 }),
    supabase
      .from("garage_slots")
      .select("position, card_copies (card_slug, serial)")
      .eq("user_id", profile.id)
      .order("position")
      .limit(3),
    supabase.from("card_copies").select("card_slug, serial").eq("owner_id", profile.id),
  ]);

  const standing = board?.find((row) => row.user_id === profile.id);
  const owned = copies ?? [];
  const toShown = ({ card_slug, serial }: { card_slug: string; serial: number }) => {
    const card = cardBySlug(card_slug);
    return card ? { card: toFace(card), serial } : null;
  };
  // The garage is their own pick; without one, their rarest cars.
  let shown = (garage ?? []).flatMap((slot) => (slot.card_copies ? [toShown(slot.card_copies)] : []));
  if (shown.length === 0) {
    const bySlug = new Map(owned.map((copy) => [copy.card_slug, copy]));
    shown = [...bySlug.values()]
      .map(toShown)
      .filter((s): s is { card: CardFace; serial: number } => s !== null)
      .sort((a, b) => byRarity(a.card, b.card))
      .slice(0, 3);
  }

  return {
    name: profile.display_name ?? "Collectionneur",
    handle: profile.handle,
    avatarUrl: profile.avatar_url,
    rank: standing ? Number(standing.rank) : null,
    score: Number(standing?.score ?? 0),
    cars: new Set(owned.map((copy) => copy.card_slug)).size,
    shown: shown.filter((s) => s !== null),
  };
}

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const [player, fonts] = await Promise.all([profileCard((await params).handle), ogFonts()]);
  if (!player) {
    return new ImageResponse(<OgTable>{null}</OgTable>, { ...size, fonts });
  }

  const [avatar, ...photos] = await Promise.all([
    photoData(player.avatarUrl, 280),
    ...player.shown.map((s) => photoData(s.card.image, 400)),
  ]);
  const stats: [string, string][] = [
    ["Classement", player.rank ? `#${formatInt(player.rank)}` : "—"],
    ["Score", formatInt(player.score)],
    ["Voitures", `${formatInt(player.cars)} / ${formatInt(CATALOGUE_SIZE)}`],
  ];
  const fan = [
    { rotate: -9, x: 0, y: 26 },
    { rotate: 0, x: 150, y: 0 },
    { rotate: 9, x: 300, y: 26 },
  ];

  return new ImageResponse(
    (
      <OgTable footer="Son garage sur Kuruma">
        <div style={{ display: "flex", alignItems: "center", width: "100%", paddingBottom: 56 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
              <div
                style={{
                  display: "flex",
                  width: 132,
                  height: 132,
                  borderRadius: 132,
                  border: `6px solid ${C.accent}`,
                  background: C.surface,
                  overflow: "hidden",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "Russo One",
                  fontSize: 60,
                }}
              >
                {avatar ? (
                   
                  <img src={avatar} alt="" width={120} height={120} style={{ objectFit: "cover" }} />
                ) : (
                  player.name.slice(0, 1).toUpperCase()
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    fontFamily: "Russo One",
                    fontSize: player.name.length > 16 ? 48 : 62,
                    lineHeight: 1.05,
                    textShadow: "0 4px 0 rgba(6,3,30,0.6)",
                  }}
                >
                  {player.name}
                </div>
                <div style={{ display: "flex", marginTop: 8, fontSize: 28, color: C.muted }}>@{player.handle}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 44 }}>
              {stats.map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    padding: "16px 22px",
                    borderRadius: 18,
                    background: "rgba(18,12,60,0.7)",
                    border: "2px solid #4a40aa",
                  }}
                >
                  <span style={{ fontSize: 20, color: C.muted }}>{label}</span>
                  <span style={{ fontFamily: "Russo One", fontSize: 38, marginTop: 4 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
          {player.shown.length > 0 && (
            <div style={{ display: "flex", position: "relative", width: 480, height: 420 }}>
              {player.shown.map((s, i) => (
                <div key={s.card.slug} style={{ display: "flex", position: "absolute", left: fan[i].x, top: fan[i].y }}>
                  <OgCard card={s.card} photo={photos[i]} serial={s.serial} width={190} rotate={fan[i].rotate} />
                </div>
              ))}
            </div>
          )}
        </div>
      </OgTable>
    ),
    { ...size, fonts },
  );
}
