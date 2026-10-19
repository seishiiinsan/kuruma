# Kuruma

Jeu de cartes à collectionner (TCG) autour de la culture automobile, sur le web : on se connecte avec Discord, on ouvre des boosters gratuits, on échange avec les autres joueurs et on expose son garage. Le catalogue compte 2 445 vraies voitures, de toutes les cultures (JDM, muscle cars, exotiques européennes, kei cars, youngtimers…), tirées de Wikidata, Wikipédia et Wikimedia Commons.

Production : [kuruma.games](https://kuruma.games)

## Le jeu en bref

- **Rareté réelle** : une voiture n'a jamais plus d'exemplaires dans le jeu que d'unités construites. Chaque exemplaire est numéroté.
- **Boosters** gratuits qui se rechargent avec le temps, plus des boosters thématiques et ceux des salons auto.
- **Jetons** : monnaie gagnée uniquement en jouant (succès, bonus quotidien, missions, revente de doublons) et dépensée uniquement en jeu. Aucun achat avec de l'argent réel, aucune publicité.
- **Échanges** entre joueurs, **marché** d'occasion avec une cote par carte, **boutique** du jour et de la semaine.
- **Album** de séries à compléter, **classement**, profil public personnalisable (titres, badges, cadres, bannières).

Le détail produit est dans [PRODUCT.md](PRODUCT.md), la direction artistique dans [DESIGN.md](DESIGN.md).

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Cache Components, `proxy.ts`), React 19, TypeScript
- Tailwind CSS v4, `motion` pour les animations, three.js pour l'ouverture des boosters
- [Supabase](https://supabase.com) : Postgres, authentification Discord, stockage des photos. Toute la logique de jeu sensible (ouverture de pack, marché, échanges, jetons) vit dans des fonctions SQL `security definer`.

## Démarrer en local

Prérequis : Node 20+, un projet Supabase (ou la stack locale, voir plus bas) avec Discord activé comme fournisseur d'authentification.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Renseigne dans `.env.local` :

| Variable | Rôle |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clé publique (publishable) du projet |
| `NEXT_PUBLIC_SITE_URL` | Adresse publique du site, pour les liens absolus, le sitemap et les aperçus de partage. Facultatif : `https://kuruma.games` en production, `http://localhost:3000` en dev |

Puis :

```bash
npm run dev
```

Le jeu tourne sur [http://localhost:3000](http://localhost:3000).

## Base de données

Le schéma est entièrement décrit par les migrations de [`supabase/migrations/`](supabase/migrations), appliquées avec la CLI Supabase :

```bash
supabase db push
```

Les types TypeScript de la base sont dans [`lib/supabase/types.ts`](lib/supabase/types.ts).

Un jeu de données de test (joueurs factices, échanges, ventes…) est dans [`scripts/seed/`](scripts/seed).

## Tests

Les fonctions SQL de l'économie (ouverture de pack, marché, échanges, export des données) sont testées avec [pgTAP](https://pgtap.org) sur une base Supabase locale (Docker requis) :

```bash
supabase start
```

```bash
npm run test:db
```

Voir [`supabase/tests/README.md`](supabase/tests/README.md) pour le détail de ce qui est couvert.

## Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run lint` | ESLint |
| `npm run test:db` | Tests SQL (pgTAP) |
| `node scripts/cars/build-cards.mjs` | Régénère le catalogue (`data/cards.json` et la migration des cartes) à partir de `data/cars.json` |
| `node scripts/icons/build-icons.mjs` | Régénère le favicon et les icônes de l'app installable |

Les illustrations des boosters se régénèrent à la main, voir [`scripts/packs/README.md`](scripts/packs/README.md).

## Organisation

```
app/            Routes (App Router). (jeu)/ : écrans du jeu, (legal)/ : pages légales
app/actions/    Server Actions (packs, échanges, marché, cosmétiques…)
components/     Composants d'interface ; components/game/ pour les écrans de jeu
lib/            Règles du jeu côté app, accès aux données, helpers
data/           Catalogue généré (cartes, séries)
supabase/       Migrations SQL et tests pgTAP
scripts/        Génération du catalogue, des icônes, des boosters, données de test
```

## Partage et installation

- `sitemap.xml` et `robots.txt` sont générés par [`app/sitemap.ts`](app/sitemap.ts) et [`app/robots.ts`](app/robots.ts) : cartes, profils, albums et classement sont indexables, les écrans personnels ne le sont pas.
- Chaque carte et chaque profil joueur a sa propre image d'aperçu (Open Graph), dessinée à la volée par `opengraph-image.tsx`, pour un bel aperçu quand un lien est partagé sur Discord.
- Le manifest ([`app/manifest.ts`](app/manifest.ts)) permet d'installer Kuruma sur l'écran d'accueil comme une application.

## Données personnelles

Chaque joueur peut, depuis ses paramètres, télécharger toutes ses données (fichier JSON) et supprimer son compte. Voir la [politique de confidentialité](app/(legal)/confidentialite/page.tsx).

## Crédits

Photos des voitures : Wikimedia Commons, avec l'auteur et la licence sur la page de chaque carte. Textes : Wikipédia. Données : Wikidata. Polices Russo One et Nunito (SIL Open Font License).
