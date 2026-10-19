import { ImageResponse } from "next/og";
import { CATALOGUE_SIZE, showcase } from "@/lib/catalog";
import { formatInt, toFace } from "@/lib/cards";
import { C, OG_SIZE, OgCard, OgTable, ogFonts, photoData } from "@/lib/og";

export const alt = "Kuruma, le jeu de cartes à collectionner de toutes les cultures auto";
export const size = OG_SIZE;
export const contentType = "image/png";

// One car per scene: the pitch is breadth, not one culture.
const FAN = showcase(["toyota-supra", "lamborghini-veneno"]);

export default async function Image() {
  const [fonts, ...photos] = await Promise.all([ogFonts(), ...FAN.map((card) => photoData(card.image, 400))]);
  return new ImageResponse(
    (
      <OgTable footer="Gratuit · connexion avec Discord">
        <div style={{ display: "flex", alignItems: "center", width: "100%", paddingBottom: 56 }}>
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div
              style={{
                display: "flex",
                fontFamily: "Russo One",
                fontSize: 74,
                lineHeight: 1.02,
                textShadow: "0 5px 0 rgba(6,3,30,0.6)",
              }}
            >
              Toutes les cultures auto, une seule collection
            </div>
            <div style={{ display: "flex", marginTop: 26, fontSize: 30, color: C.muted }}>
              {`Ouvre des boosters, échange et expose ${formatInt(CATALOGUE_SIZE)} vraies voitures.`}
            </div>
          </div>
          <div style={{ display: "flex", position: "relative", width: 400, height: 420 }}>
            {FAN.map((card, i) => (
              <div
                key={card.slug}
                style={{ display: "flex", position: "absolute", left: 30 + i * 150, top: i === 0 ? 30 : 0 }}
              >
                <OgCard card={toFace(card)} photo={photos[i]} width={210} rotate={i === 0 ? -8 : 7} />
              </div>
            ))}
          </div>
        </div>
      </OgTable>
    ),
    { ...size, fonts },
  );
}
