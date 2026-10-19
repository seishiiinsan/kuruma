import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mentions légales — Kuruma" };

export default function LegalNoticePage() {
  return (
    <>
      <h1>Mentions légales</h1>

      <h2>Éditeur du site</h2>
      <p>
        Le site Kuruma (kuruma.games) est édité à titre non professionnel par un particulier qui,
        conformément à l&apos;article 6-III-2 de la loi n° 2004-575 du 21 juin
        2004 (LCEN), a choisi de rester anonyme. Ses coordonnées ont été
        communiquées à l&apos;hébergeur ci-dessous.
        <br />
        Contact : <a href="mailto:gabinhalloss@gmail.com">gabinhalloss@gmail.com</a>
      </p>

      <h2>Hébergement</h2>
      <p>
        Site : Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723,
        États-Unis (vercel.com, privacy@vercel.com).
        <br />
        Données : Supabase Pte. Ltd., 970 Toa Payoh North #07-04, Singapour
        318992 (supabase.com, privacy@supabase.com). Les données sont
        stockées dans la région Europe (Paris).
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Le nom Kuruma, le site et sa mise en forme appartiennent à
        l&apos;éditeur. Les noms et marques de voitures appartiennent à leurs
        propriétaires ; Kuruma n&apos;est affilié à aucun constructeur.
      </p>
      <p>
        Les fiches des voitures sont tirées de Wikidata (domaine public, CC0)
        et de Wikipédia (licence CC BY-SA 4.0) : chaque fiche renvoie à
        l&apos;article d&apos;origine. Les photos proviennent de Wikimedia
        Commons ; leur auteur et leur licence sont indiqués sous chaque carte.
      </p>

      <h2>Données personnelles</h2>
      <p>
        Voir la <a href="/confidentialite">politique de confidentialité</a>.
      </p>
    </>
  );
}
