import { ImageResponse } from "next/og";
import { cacheLife } from "next/cache";
import { cardBySlug } from "@/lib/catalog";
import { TIERS, formatInt, toFace } from "@/lib/cards";
import { C, Diamonds, OG_SIZE, OgCard, OgTable, TIER_HEX, ogFonts, photoData } from "@/lib/og";
import { supabasePublic } from "@/lib/supabase/public";

export const alt = "Carte Kuruma";
export const size = OG_SIZE;
export const contentType = "image/png";

async function minted(slug: string) {
  "use cache";
  cacheLife("hours");
  const { data } = await supabasePublic().from("cards").select("minted").eq("slug", slug).maybeSingle();
  return data?.minted ?? 0;
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const card = cardBySlug((await params).slug);
  const fonts = await ogFonts();
  if (!card) {
    return new ImageResponse(<OgTable>{null}</OgTable>, { ...size, fonts });
  }

  const [photo, count] = await Promise.all([photoData(card.image, 640), minted(card.slug)]);
  const tier = TIERS[card.tier];
  const meta = [card.brand, card.year, card.country].filter(Boolean).join(" · ");
  const rarity =
    card.supply === null
      ? `${formatInt(count)} en circulation`
      : card.supply <= 10
        ? `${formatInt(card.supply)} exemplaire${card.supply > 1 ? "s" : ""} au monde, ${formatInt(count)} tiré${count > 1 ? "s" : ""}`
        : `${formatInt(count)} tirés sur ${formatInt(card.supply)} construits`;

  return new ImageResponse(
    (
      <OgTable footer="Collectionne-la sur Kuruma">
        <div style={{ display: "flex", alignItems: "center", gap: 72, width: "100%", paddingBottom: 56 }}>
          <div style={{ display: "flex", paddingLeft: 24 }}>
            <OgCard card={toFace(card)} photo={photo} width={300} rotate={-4} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                alignSelf: "flex-start",
                padding: "10px 20px",
                borderRadius: 99,
                background: C.surface,
                color: TIER_HEX[card.tier],
                fontSize: 26,
              }}
            >
              <Diamonds tier={card.tier} size={20} />
              {tier.label}
              <span style={{ color: C.muted }}>{`· ${card.culture}`}</span>
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 22,
                fontFamily: "Russo One",
                fontSize: card.name.length > 28 ? 52 : 66,
                lineHeight: 1.05,
                textShadow: "0 4px 0 rgba(6,3,30,0.6)",
              }}
            >
              {card.name}
            </div>
            {meta && <div style={{ display: "flex", marginTop: 18, fontSize: 30, color: C.muted }}>{meta}</div>}
            <div style={{ display: "flex", marginTop: 28, fontSize: 28, color: C.accent }}>{rarity}</div>
          </div>
        </div>
      </OgTable>
    ),
    { ...size, fonts },
  );
}
