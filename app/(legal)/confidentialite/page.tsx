import type { Metadata } from "next";

export const metadata: Metadata = { title: "Confidentialité — Kuruma" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Politique de confidentialité</h1>
      <p>Dernière mise à jour : 19 octobre 2026.</p>

      <h2>Responsable du traitement</h2>
      <p>
        L&apos;éditeur de Kuruma (voir les{" "}
        <a href="/mentions-legales">mentions légales</a>), joignable à{" "}
        <a href="mailto:gabinhalloss@gmail.com">gabinhalloss@gmail.com</a>.
      </p>

      <h2>Données collectées</h2>
      <ul>
        <li>
          Compte joueur (connexion Discord) : ton identifiant Discord, ton
          nom affiché, ton avatar et ton adresse email.
        </li>
        <li>
          Jeu : les packs ouverts, les cartes possédées, ton garage, tes
          échanges et tes notifications.
        </li>
        <li>
          Modération : les signalements que tu envoies ou reçois, les
          sanctions éventuelles et la date de création de ton compte Discord
          (déduite de ton identifiant Discord).
        </li>
        <li>
          Mesure d&apos;audience et erreurs : pages vues, pays, type
          d&apos;appareil et de navigateur, temps de chargement et erreurs
          techniques, sans cookie ni identifiant persistant.
        </li>
        <li>
          Inscriptions à l&apos;ancienne liste d&apos;attente : adresse email,
          page d&apos;inscription et type de navigateur.
        </li>
      </ul>
      <p>On ne collecte ni mot de passe ni donnée de paiement.</p>

      <h2>Pourquoi</h2>
      <ul>
        <li>Faire fonctionner ton compte et le jeu (exécution du service).</li>
        <li>Protéger le jeu contre la triche et les comptes multiples, et corriger les bugs (intérêt légitime).</li>
        <li>Te prévenir par email des nouveautés, si tu t&apos;étais inscrit à la liste d&apos;attente (ton consentement).</li>
      </ul>

      <h2>Ce qui est public</h2>
      <p>
        Ton profil est visible par tous : ton nom et ton avatar Discord, ta
        date d&apos;inscription, ton garage, ta collection et ton classement.
        Ton email et ton identifiant Discord ne sont jamais affichés.
      </p>

      <h2>Âge minimum</h2>
      <p>
        Kuruma est réservé aux personnes de 15 ans et plus. Si tu as moins de
        15 ans, tu ne peux pas créer de compte.
      </p>

      <h2>Destinataires</h2>
      <p>
        Les données sont hébergées par Supabase, dans la région Europe
        (Paris), et le site par Vercel. Ces prestataires peuvent accéder aux
        données depuis l&apos;extérieur de l&apos;Union européenne, dans le
        cadre des clauses contractuelles types de la Commission européenne. La connexion passe par Discord, qui t&apos;indique les
        informations partagées avant d&apos;accepter. Aucune donnée
        n&apos;est vendue ni transmise à des fins publicitaires.
      </p>

      <h2>Durée de conservation</h2>
      <p>
        Tes données sont conservées tant que ton compte ou ton inscription
        existe, puis effacées. Une inscription à la liste d&apos;attente qui
        n&apos;est pas devenue un compte est effacée au plus tard trois ans
        après le dernier contact.
      </p>

      <h2>Cookies</h2>
      <p>
        Le site n&apos;utilise que des cookies nécessaires à la connexion de
        ton compte. Aucun cookie de mesure d&apos;audience ou de publicité :
        la fréquentation est mesurée par Vercel Web Analytics et Speed
        Insights, sans cookie, sur des données anonymisées.
      </p>

      <h2>Tes droits</h2>
      <p>
        Tu peux accéder à tes données, les corriger, les effacer, t&apos;opposer
        à leur traitement ou en demander une copie. Depuis les{" "}
        <a href="/parametres">paramètres</a>, tu peux toi-même télécharger
        toutes tes données dans un fichier JSON et supprimer ton compte, ou
        écrire à <a href="mailto:gabinhalloss@gmail.com">gabinhalloss@gmail.com</a>. Tu peux aussi adresser une
        réclamation à la CNIL (cnil.fr).
      </p>
    </>
  );
}
