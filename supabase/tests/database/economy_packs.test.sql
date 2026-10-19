-- Ouverture de packs : portefeuille de packs gratuits, packs bonus, packs
-- payés en jetons, tirage borné par cards.supply et numéros de série uniques.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(37);

/* ---------- Jeu de données ---------- */

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-a000-000000000101', 'pack-a@kuruma.test', '{"full_name":"Pack A","provider_id":"101"}'),
  ('00000000-0000-4000-a000-000000000102', 'pack-b@kuruma.test', '{"full_name":"Pack B","provider_id":"102"}');

-- Ce que le dernier appel a tiré, pour les assertions faites en postgres.
create temp table pulled (copy_id uuid, card_slug text, serial int);
grant all on pulled to authenticated;

/* ---------- Sans session ---------- */

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';

select throws_ok(
  $$ select * from public.open_pack('edition-01') $$,
  'P0001', 'not authenticated',
  'open_pack refuse un appel sans joueur connecté'
);

/* ---------- Pack gratuit ---------- */

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000101","role":"authenticated"}';

select throws_ok(
  $$ select * from public.open_pack('pack-inexistant') $$,
  'P0001', 'unknown pack',
  'open_pack refuse un pack inconnu'
);

select is(
  (select available from public.my_pack_wallet()), 10,
  'un nouveau joueur a 10 packs gratuits'
);
select is((select coins from public.my_pack_wallet()), 0, 'un nouveau joueur a 0 jeton');

insert into pulled select * from public.open_pack('edition-01');

select is((select count(*)::int from pulled), 5, 'un pack Édition 01 donne 5 cartes');
select is(
  (select count(*)::int from pulled p join public.card_copies c on c.id = p.copy_id
   where c.owner_id = '00000000-0000-4000-a000-000000000101' and c.obtained_via = 'pack'),
  5,
  'les 5 copies tirées appartiennent au joueur, obtenues par pack'
);
select ok(
  (select bool_or(k.tier <> 'common') from pulled p join public.cards k on k.slug = p.card_slug),
  'le dernier emplacement garantit au moins une rare'
);
select is((select available from public.my_pack_wallet()), 9, 'ouvrir un pack gratuit en consomme un');
select is((select coins from public.my_pack_wallet()), 0, 'un pack gratuit ne coûte aucun jeton');

reset role;

select is(
  (select copies from public.pack_openings where user_id = '00000000-0000-4000-a000-000000000101'),
  (select array_agg(copy_id) from pulled),
  'l''ouverture est journalisée avec les copies tirées'
);

/* ---------- Packs payés ---------- */

set local role authenticated;
truncate pulled;

select throws_ok(
  $$ select * from public.open_pack('edition-01', true) $$,
  'P0001', 'not enough coins',
  'payer un pack gratuit sans jetons est refusé'
);
select throws_ok(
  $$ select * from public.open_pack('legende') $$,
  'P0001', 'not enough coins',
  'un pack premium sans jetons est refusé'
);
select is((select available from public.my_pack_wallet()), 9, 'un achat refusé ne consomme aucun pack gratuit');

reset role;
select is(
  (select count(*)::int from public.card_copies where owner_id = '00000000-0000-4000-a000-000000000101'),
  5,
  'un achat refusé ne crée aucune copie'
);
select public.move_coins('00000000-0000-4000-a000-000000000101', 2000, 'daily', 'test');
set local role authenticated;

insert into pulled select * from public.open_pack('legende');
select is((select coins from public.my_pack_wallet()), 800, 'le pack Légende coûte 1200 jetons');
select is((select available from public.my_pack_wallet()), 9, 'un pack premium ne touche pas aux packs gratuits');
select is((select count(*)::int from pulled), 3, 'un pack Légende donne 3 cartes');
select ok(
  (select bool_and(k.tier in ('epic', 'legendary')) from pulled p join public.cards k on k.slug = p.card_slug),
  'un pack Légende ne donne que des épiques ou légendaires'
);

insert into pulled select * from public.open_pack('edition-01', true);
select is((select coins from public.my_pack_wallet()), 600, 'payer un pack gratuit coûte son prix (200)');
select is((select available from public.my_pack_wallet()), 9, 'payer un pack gratuit garde les packs gratuits');

reset role;

select is(
  (select array_agg(amount order by id) from public.coin_ledger
   where user_id = '00000000-0000-4000-a000-000000000101' and reason = 'pack'),
  array[-1200, -200],
  'chaque pack payé est inscrit au journal des jetons'
);
select is(
  (select coins from public.pack_wallets where user_id = '00000000-0000-4000-a000-000000000101'),
  (select sum(amount)::int from public.coin_ledger where user_id = '00000000-0000-4000-a000-000000000101'),
  'le solde de jetons égale la somme du journal'
);

/* ---------- Plus de pack gratuit : bonus, puis refus ---------- */

update public.pack_wallets set stored = 0, anchor_at = now(), bonus = 1
  where user_id = '00000000-0000-4000-a000-000000000101';

set local role authenticated;
truncate pulled;
insert into pulled select * from public.open_pack('edition-01');
select is((select count(*)::int from pulled), 5, 'sans pack gratuit, un pack bonus s''ouvre');
select is((select bonus from public.my_pack_wallet()), 0, 'le pack bonus est consommé');
select is((select available from public.my_pack_wallet()), 0, 'les packs gratuits restent à 0');

select throws_ok(
  $$ select * from public.open_pack('edition-01') $$,
  'P0001', 'no packs available',
  'sans pack gratuit ni bonus, l''ouverture est refusée'
);

/* ---------- Packs hors période ---------- */

select throws_ok(
  format('select * from public.open_pack(%L, true)',
    (select s.pack_id from public.salons s
     where s.pack_id not in (select n.pack_id from public.salon_now() n)
     order by s.id limit 1)),
  'P0001', 'pack not available',
  'le pack d''un salon ne s''ouvre pas hors de sa semaine'
);
select throws_ok(
  format('select * from public.open_pack(%L, true)',
    (select p.id from public.packs p
     where p.rotation is not null and p.id is distinct from public.weekend_pack()
     order by p.rotation limit 1)),
  'P0001', 'pack not available',
  'un pack du week-end ne s''ouvre pas hors de son tour'
);

reset role;

/* ---------- Numéros de série ---------- */

select is(
  (select count(*)::int from public.cards k
   where k.minted <> (select count(*) from public.card_copies c where c.card_slug = k.slug)),
  0,
  'pour chaque carte, minted égale le nombre de copies'
);
select is(
  (select count(*)::int from public.cards k
   where k.minted > 0
     and (select array_agg(c.serial order by c.serial) from public.card_copies c where c.card_slug = k.slug)
         <> (select array_agg(g) from generate_series(1, k.minted) g)),
  0,
  'les numéros de série de chaque carte vont de 1 à minted, sans trou ni doublon'
);
select is(
  (select count(*)::int from public.cards where supply is not null and minted > supply),
  0,
  'aucune carte n''est tirée au-delà de son tirage réel'
);

/* ---------- Tirage limité : le catalogue s'épuise ---------- */

-- Tout le catalogue est épuisé, sauf deux communes de test à 3 exemplaires.
update public.cards set minted = greatest(minted, 1), supply = greatest(minted, 1);
insert into public.cards (slug, tier, culture, traits, supply) values
  ('zz-test-pack-a', 'common', 'Test', '{}', 3),
  ('zz-test-pack-b', 'common', 'Test', '{}', 3);
insert into public.pack_wallets (user_id, coins) values ('00000000-0000-4000-a000-000000000102', 0);
select public.move_coins('00000000-0000-4000-a000-000000000102', 500, 'daily', 'test');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000102","role":"authenticated"}';
truncate pulled;
insert into pulled select * from public.open_pack('edition-01');
reset role;

select is(
  (select count(*)::int from pulled where card_slug in ('zz-test-pack-a', 'zz-test-pack-b')),
  5,
  'les emplacements rares retombent sur les communes encore disponibles'
);
select is(
  (select sum(minted)::int from public.cards where slug in ('zz-test-pack-a', 'zz-test-pack-b')),
  5,
  'minted compte exactement les copies tirées'
);
select ok(
  (select bool_and(serial between 1 and 3) from pulled)
  and (select count(distinct (card_slug, serial)) from pulled) = 5,
  'les numéros tirés restent dans le tirage et sont uniques'
);

set local role authenticated;
select throws_ok(
  $$ select * from public.open_pack('edition-01', true) $$,
  'P0001', 'catalogue sold out',
  'un pack qu''on ne peut plus remplir est refusé'
);
reset role;

select is(
  (select coins from public.pack_wallets where user_id = '00000000-0000-4000-a000-000000000102'),
  500,
  'un pack refusé faute de cartes ne coûte rien (tout est annulé)'
);
select ok(
  (select sum(minted)::int from public.cards where slug in ('zz-test-pack-a', 'zz-test-pack-b')) = 5
  and (select count(*) from public.card_copies where owner_id = '00000000-0000-4000-a000-000000000102') = 5,
  'un pack refusé ne tire aucune carte partiellement'
);

select * from finish();
rollback;
