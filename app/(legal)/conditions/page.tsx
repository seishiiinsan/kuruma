import type { Metadata } from "next";

export const metadata: Metadata = { title: "Conditions d'utilisation — Kuruma" };

export default function TermsPage() {
  return (
    <>
      <h1>Conditions d&apos;utilisation</h1>
      <p>Dernière mise à jour : 19 octobre 2026.</p>

      <h2>Objet</h2>
      <p>
        Ces conditions encadrent l&apos;utilisation du site Kuruma, un jeu de
        cartes à collectionner sur l&apos;automobile, gratuit et sans achat.
      </p>

      <h2>Accès et compte</h2>
      <p>
        La création d&apos;un compte est gratuite. Il faut avoir au moins 15
        ans. Le compte se crée via Discord : tu dois aussi respecter les
        conditions d&apos;utilisation de Discord.
      </p>

      <h2>Cartes et échanges</h2>
      <p>
        Les cartes s&apos;obtiennent en ouvrant des packs, en échangeant avec
        d&apos;autres joueurs et à la boutique du jeu, contre des jetons. Les
        jetons se gagnent uniquement en jouant (succès, prime du jour, revente
        de doubles à la boutique) : ils ne s&apos;achètent pas, ne se
        convertissent pas en argent et ne se transfèrent pas entre joueurs.
        Cartes et jetons n&apos;ont aucune valeur monétaire et ne peuvent être
        ni achetés ni vendus contre de l&apos;argent réel. Un échange accepté,
        un achat ou une revente en boutique sont définitifs. L&apos;usage de plusieurs comptes ou
        d&apos;automatismes pour obtenir des cartes est interdit.
      </p>

      <h2>Comportement</h2>
      <p>
        Tu t&apos;engages à ne pas utiliser le site de façon abusive, à ne pas
        tenter d&apos;en contourner la sécurité et à rester respectueux des
        autres joueurs. Un compte qui ne respecte pas ces règles peut être
        suspendu.
      </p>

      <h2>Responsabilité</h2>
      <p>
        Le service est fourni en l&apos;état pendant sa phase de
        développement, sans garantie de disponibilité continue.
      </p>

      <h2>Modifications</h2>
      <p>
        Ces conditions peuvent évoluer, notamment au lancement du jeu. La
        date de mise à jour en haut de page indique la version en vigueur.
      </p>

      <h2>Droit applicable</h2>
      <p>
        Ces conditions sont soumises au droit français. En cas de litige, une
        solution amiable sera recherchée avant toute action en justice.
      </p>

      <h2>Contact</h2>
      <p>
        Pour toute question : <a href="mailto:gabinhalloss@gmail.com">gabinhalloss@gmail.com</a>.
      </p>
    </>
  );
}
