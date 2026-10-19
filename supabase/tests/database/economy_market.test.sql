-- Marché entre joueurs : mise en vente, achat, retrait, expiration,
-- commission brûlée et journal des jetons.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(47);

/* ---------- Jeu de données ---------- */
-- S vend, B achète, C sert de tiers.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-a000-000000000201', 'market-s@kuruma.test', '{"full_name":"Vendeur","provider_id":"201"}'),
  ('00000000-0000-4000-a000-000000000202', 'market-b@kuruma.test', '{"full_name":"Acheteur","provider_id":"202"}'),
  ('00000000-0000-4000-a000-000000000203', 'market-c@kuruma.test', '{"full_name":"Tiers","provider_id":"203"}');

insert into public.cards (slug, tier, culture, traits, supply, minted) values
  ('zz-test-market', 'common', 'Test', '{}', null, 6);

insert into public.card_copies (id, card_slug, serial, owner_id, obtained_via) values
  ('00000000-0000-4000-b000-000000000201', 'zz-test-market', 1, '00000000-0000-4000-a000-000000000201', 'pack'),
  ('00000000-0000-4000-b000-000000000202', 'zz-test-market', 2, '00000000-0000-4000-a000-000000000201', 'pack'),
  ('00000000-0000-4000-b000-000000000203', 'zz-test-market', 3, '00000000-0000-4000-a000-000000000201', 'pack'),
  ('00000000-0000-4000-b000-000000000204', 'zz-test-market', 4, '00000000-0000-4000-a000-000000000201', 'pack'),
  ('00000000-0000-4000-b000-000000000205', 'zz-test-market', 5, '00000000-0000-4000-a000-000000000203', 'pack');

-- Comptes anciens : les règles de confiance (economy_trust) ne s'appliquent pas ici.
update public.profiles set created_at = now() - interval '60 days'
  where id in ('00000000-0000-4000-a000-000000000201', '00000000-0000-4000-a000-000000000202',
               '00000000-0000-4000-a000-000000000203');

select public.move_coins('00000000-0000-4000-a000-000000000202', 60, 'daily', 'test');
insert into public.pack_wallets (user_id) values ('00000000-0000-4000-a000-000000000201');

/* ---------- Commission et cote ---------- */

select is(public.market_fee(1), 1, 'la commission vaut au moins 1 jeton');
select is(public.market_fee(15), 2, 'la commission de 10 % est arrondie au supérieur');
select is(public.market_fee(100), 10, 'la commission vaut 10 % du prix');
select results_eq(
  $$ select reference, min_price, max_price, sales from public.market_quote('zz-test-market') $$,
  $$ values (50, 25, 150, 0) $$,
  'sans ventes, la cote d''une commune est le prix d''occasion (50), de 25 à 150 jetons'
);

/* ---------- Mettre en vente ---------- */

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000202","role":"authenticated"}';

select throws_ok(
  $$ select public.list_copy('00000000-0000-4000-b000-000000000201', 100) $$,
  'P0001', 'not your card',
  'on ne peut pas vendre la copie d''un autre'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000201","role":"authenticated"}';

select throws_ok(
  $$ select public.list_copy('00000000-0000-4000-b000-000000000201', 24) $$,
  'P0001', 'price out of range',
  'un prix sous la moitié de la cote est refusé'
);
select throws_ok(
  $$ select public.list_copy('00000000-0000-4000-b000-000000000201', null) $$,
  'P0001', 'price out of range',
  'un prix vide est refusé'
);
select throws_ok(
  $$ select public.list_copy('00000000-0000-4000-b000-000000000201', 151) $$,
  'P0001', 'price out of range',
  'un prix au-dessus de 3x la cote est refusé'
);

select lives_ok(
  $$ select public.set_garage(array['00000000-0000-4000-b000-000000000201']::uuid[]) $$,
  'la copie est exposée au garage'
);
select lives_ok(
  $$ select public.list_copy('00000000-0000-4000-b000-000000000201', 100) $$,
  'une copie du garage peut être mise en vente'
);
select is(
  (select owner_id from public.card_copies where id = '00000000-0000-4000-b000-000000000201'),
  null,
  'une copie en vente n''appartient plus à personne'
);
select is(
  (select count(*)::int from public.garage_slots where copy_id = '00000000-0000-4000-b000-000000000201'),
  0,
  'la copie mise en vente quitte le garage'
);
select results_eq(
  $$ select seller_id, price from public.market_listings where copy_id = '00000000-0000-4000-b000-000000000201' $$,
  $$ values ('00000000-0000-4000-a000-000000000201'::uuid, 100) $$,
  'l''annonce porte le vendeur et le prix'
);
select throws_ok(
  $$ select public.list_copy('00000000-0000-4000-b000-000000000201', 100) $$,
  'P0001', 'not your card',
  'une copie déjà en vente ne peut pas être remise en vente'
);
select throws_ok(
  $$ select public.buy_listing('00000000-0000-4000-b000-000000000201') $$,
  'P0001', 'your own listing',
  'on ne peut pas acheter sa propre annonce'
);

/* ---------- Acheter ---------- */

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000202","role":"authenticated"}';

select throws_ok(
  $$ select public.buy_listing('00000000-0000-4000-b000-000000000201') $$,
  'P0001', 'not enough coins',
  'acheter sans assez de jetons est refusé'
);

reset role;
select ok(
  exists (select 1 from public.market_listings where copy_id = '00000000-0000-4000-b000-000000000201')
  and (select coins from public.pack_wallets where user_id = '00000000-0000-4000-a000-000000000202') = 60
  and (select coins from public.pack_wallets where user_id = '00000000-0000-4000-a000-000000000201') = 0,
  'un achat refusé ne touche ni à l''annonce ni aux soldes'
);
select public.move_coins('00000000-0000-4000-a000-000000000202', 100, 'daily', 'test');
set local role authenticated;

select lives_ok(
  $$ select public.buy_listing('00000000-0000-4000-b000-000000000201') $$,
  'l''acheteur achète l''annonce'
);

reset role;
select is(
  (select coins from public.pack_wallets where user_id = '00000000-0000-4000-a000-000000000202'),
  60,
  'l''acheteur paie le prix affiché (160 - 100)'
);
select is(
  (select coins from public.pack_wallets where user_id = '00000000-0000-4000-a000-000000000201'),
  90,
  'le vendeur reçoit le prix moins la commission (100 - 10)'
);
select results_eq(
  $$ select owner_id, obtained_via from public.card_copies where id = '00000000-0000-4000-b000-000000000201' $$,
  $$ values ('00000000-0000-4000-a000-000000000202'::uuid, 'market') $$,
  'la copie passe à l''acheteur, obtenue au marché'
);
select is(
  (select count(*)::int from public.market_listings where copy_id = '00000000-0000-4000-b000-000000000201'),
  0,
  'l''annonce vendue disparaît'
);
select results_eq(
  $$ select seller_id, buyer_id, price, fee from public.market_sales where copy_id = '00000000-0000-4000-b000-000000000201' $$,
  $$ values ('00000000-0000-4000-a000-000000000201'::uuid, '00000000-0000-4000-a000-000000000202'::uuid, 100, 10) $$,
  'la vente est enregistrée pour la cote'
);
select is(
  (select array_agg(amount order by amount) from public.coin_ledger where reason = 'market' and ref = 'zz-test-market'),
  array[-100, 90],
  'les deux mouvements de jetons sont journalisés'
);
select ok(
  exists (select 1 from public.notifications
          where user_id = '00000000-0000-4000-a000-000000000201' and kind = 'market_sold'),
  'le vendeur est prévenu de la vente'
);

set local role authenticated;
select throws_ok(
  $$ select public.buy_listing('00000000-0000-4000-b000-000000000201') $$,
  'P0001', 'no longer available',
  'une annonce vendue ne peut pas être rachetée'
);

/* ---------- Retirer une annonce ---------- */

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000201","role":"authenticated"}';
select lives_ok(
  $$ select public.list_copy('00000000-0000-4000-b000-000000000202', 50) $$,
  'le vendeur met une deuxième copie en vente'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000202","role":"authenticated"}';
select throws_ok(
  $$ select public.cancel_listing('00000000-0000-4000-b000-000000000202') $$,
  'P0001', 'no longer available',
  'on ne peut pas retirer l''annonce d''un autre'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000201","role":"authenticated"}';
select lives_ok(
  $$ select public.cancel_listing('00000000-0000-4000-b000-000000000202') $$,
  'le vendeur retire son annonce'
);
select is(
  (select owner_id from public.card_copies where id = '00000000-0000-4000-b000-000000000202'),
  '00000000-0000-4000-a000-000000000201'::uuid,
  'la copie retirée revient au vendeur'
);
select is(
  (select count(*)::int from public.market_listings where copy_id = '00000000-0000-4000-b000-000000000202'),
  0,
  'l''annonce retirée disparaît'
);
select throws_ok(
  $$ select public.cancel_listing('00000000-0000-4000-b000-000000000202') $$,
  'P0001', 'no longer available',
  'une annonce ne se retire qu''une fois'
);

/* ---------- Marché et échanges ---------- */

select lives_ok(
  $$ select public.create_trade('00000000-0000-4000-a000-000000000203',
       array['00000000-0000-4000-b000-000000000203']::uuid[],
       array['00000000-0000-4000-b000-000000000205']::uuid[]) $$,
  'le vendeur propose une copie en échange'
);
select throws_ok(
  $$ select public.list_copy('00000000-0000-4000-b000-000000000203', 50) $$,
  'P0001', 'in a pending trade',
  'une copie proposée en échange ne peut pas être mise en vente'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000203","role":"authenticated"}';
select throws_ok(
  $$ select public.list_copy('00000000-0000-4000-b000-000000000205', 50) $$,
  'P0001', 'in a pending trade',
  'une copie demandée dans un échange en attente ne peut pas être mise en vente'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000201","role":"authenticated"}';
select lives_ok(
  $$ select public.list_copy('00000000-0000-4000-b000-000000000204', 50) $$,
  'le vendeur met une troisième copie en vente'
);
select throws_ok(
  $$ select public.create_trade('00000000-0000-4000-a000-000000000203',
       array['00000000-0000-4000-b000-000000000204']::uuid[],
       array['00000000-0000-4000-b000-000000000205']::uuid[]) $$,
  'P0001', 'cards changed hands',
  'une copie en vente ne peut pas être proposée en échange'
);
select throws_ok(
  $$ select public.sell_copy('00000000-0000-4000-b000-000000000204') $$,
  'P0001', 'not your card',
  'une copie en vente ne peut pas être revendue à la boutique'
);

/* ---------- Expiration ---------- */

reset role;
update public.market_listings set expires_at = now() - interval '1 second'
  where copy_id = '00000000-0000-4000-b000-000000000204';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000202","role":"authenticated"}';
select throws_ok(
  $$ select public.buy_listing('00000000-0000-4000-b000-000000000204') $$,
  'P0001', 'no longer available',
  'une annonce expirée ne peut pas être achetée'
);
select throws_ok(
  $$ select public.expire_listings() $$,
  '42501', null,
  'un joueur ne peut pas appeler expire_listings directement'
);
-- my_pack_wallet ramène les annonces expirées à leurs vendeurs.
select lives_ok($$ select * from public.my_pack_wallet() $$, 'lire son portefeuille balaie les annonces expirées');

reset role;
select is(
  (select owner_id from public.card_copies where id = '00000000-0000-4000-b000-000000000204'),
  '00000000-0000-4000-a000-000000000201'::uuid,
  'la copie d''une annonce expirée revient au vendeur'
);
select is(
  (select count(*)::int from public.market_listings where copy_id = '00000000-0000-4000-b000-000000000204'),
  0,
  'l''annonce expirée disparaît'
);
select ok(
  exists (select 1 from public.notifications
          where user_id = '00000000-0000-4000-a000-000000000201' and kind = 'market_expired'),
  'le vendeur est prévenu de l''expiration'
);

/* ---------- Conservation des jetons ---------- */

select is(
  (select sum(coins)::int from public.pack_wallets
   where user_id in ('00000000-0000-4000-a000-000000000201', '00000000-0000-4000-a000-000000000202')),
  160 - 10,
  'seule la commission sort de l''économie'
);
select is(
  (select count(*)::int from public.pack_wallets w
   where w.user_id in ('00000000-0000-4000-a000-000000000201', '00000000-0000-4000-a000-000000000202',
                       '00000000-0000-4000-a000-000000000203')
     and w.coins <> coalesce((select sum(amount) from public.coin_ledger l where l.user_id = w.user_id), 0)),
  0,
  'chaque solde égale la somme de son journal'
);
select is(
  (select count(*)::int from public.pack_wallets where coins < 0),
  0,
  'aucun solde n''est négatif'
);

select * from finish();
rollback;
