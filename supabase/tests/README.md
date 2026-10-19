# Tests de la base

Tests pgTAP des fonctions SQL de l'économie, là où un bug coûte le plus cher.
Chaque fichier tourne dans une transaction annulée à la fin (`begin` … `rollback`) :
rien ne reste en base.

## Lancer

Docker doit tourner.

```sh
supabase start -x studio,imgproxy,realtime,edge-runtime,logflare,vector,supavisor,mailpit,postgres-meta
supabase db reset   # après l'ajout ou la modification d'une migration
npm run test:db     # = supabase test db
supabase stop
```

Deux migrations ne doivent jamais partager le même horodatage : `supabase db reset`
échoue sinon (`duplicate key … schema_migrations_pkey`).

## Ce qui est couvert

- `economy_packs` : `open_pack` et `my_pack_wallet`. Packs gratuits, bonus,
  payés en jetons et premium ; refus sans pack ni jetons ; packs de salon et du
  week-end hors période ; `minted` égal au nombre de copies, numéros de série de
  1 à `minted` sans trou, jamais au-delà de `supply` ; un pack qu'on ne peut pas
  remplir est refusé sans rien débiter ni tirer.
- `economy_market` : `list_copy`, `cancel_listing`, `buy_listing`,
  `expire_listings`, `market_fee`, `market_quote`. Fourchette de prix, copie
  d'un autre, copie en garage ou dans un échange en attente, achat de sa propre
  annonce, jetons insuffisants, commission brûlée, transfert de propriété,
  retrait, expiration, conservation des jetons.
- `economy_trades` : `create_trade` et `respond_trade`. Seul le destinataire
  accepte, échange atomique, offres concurrentes expirées, copie partie
  entre-temps, annulation, refus, réponse vide, limite par paire, écritures
  directes bloquées par la RLS.
- `economy_trust` : comptes trop récents (Kuruma ou Discord), bannis, échanges
  déséquilibrés avec un jeune compte, limite par paire au marché.
- `economy_shop` : `move_coins` (journal, solde jamais négatif, interdit aux
  joueurs), `claim_daily`, `sell_copy`, `buy_used`, `buy_offer`, RLS sur les
  soldes, le journal et les copies.
- `export_my_data` : l'export ne contient que les données du joueur connecté.

Les comportements attendus mais pas encore respectés sont marqués `todo` :
ils s'affichent en échec sans faire échouer la suite.

## Écrire un test

Créer les joueurs en insérant dans `auth.users` (le trigger `handle_new_user`
crée le profil), puis les incarner :

```sql
set local role authenticated;
set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
-- …
reset role; -- retour à postgres pour préparer ou vérifier
```

Les comptes de moins de 3 jours ne peuvent ni échanger ni vendre : vieillir
`profiles.created_at` dans la préparation quand le test ne porte pas là-dessus.
