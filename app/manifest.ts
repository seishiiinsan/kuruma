import type { MetadataRoute } from "next";

/** Lets players install Kuruma on their home screen like a mobile game. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Kuruma — le jeu de cartes auto",
    short_name: "Kuruma",
    description:
      "Ouvre des boosters gratuits, échange et expose les vraies voitures de toutes les cultures auto.",
    lang: "fr",
    start_url: "/boosters",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#120c3c",
    theme_color: "#1d1656",
    categories: ["games", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Boosters", url: "/boosters" },
      { name: "Collection", url: "/collection" },
      { name: "Échanges", url: "/echanges" },
    ],
  };
}
