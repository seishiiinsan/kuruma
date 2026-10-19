-- Permis de conduire : expérience, niveaux, notifications, niveau qui ne
-- redescend jamais, places de garage, réduction en boutique, cosmétiques.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(31);

/* ---------- Barème ---------- */

select is(public.permit_threshold(1), 0, 'le niveau 1 ne demande rien');
select is(public.permit_threshold(2), 100, 'le niveau 2 demande 100 XP');
select is(public.permit_threshold(3), 250, 'chaque niveau demande 50 XP de plus que le précédent');
select is(public.permit_threshold(30), 23200, 'le niveau 30 demande 23 200 XP');
select is(public.permit_level_for(99), 1::smallint, '99 XP : encore niveau 1');
select is(public.permit_level_for(100), 2::smallint, '100 XP : niveau 2');
select is(public.permit_level_for(10000000), 30::smallint, 'le niveau plafonne à 30');

select is(
  array[public.permit_garage_slots(1), public.permit_garage_slots(5), public.permit_garage_slots(10),
        public.permit_garage_slots(20), public.permit_garage_slots(30)],
  array[6, 7, 8, 9, 10],
  'une place de garage de plus aux niveaux 5, 10, 20 et 30'
);
select is(
  array[public.permit_discount(9), public.permit_discount(10), public.permit_discount(20), public.permit_discount(30)],
  array[0, 5, 10, 15],
  'réduction de 5, 10 puis 15 % en boutique'
);
select is(public.discounted(101, 10), 96, 'le prix réduit est arrondi au jeton supérieur');

/* ---------- Jeu de données ---------- */
-- P progresse, Q sert de partenaire d'échange.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-a000-000000000701', 'permit-p@kuruma.test', '{"full_name":"Permit P","provider_id":"701"}'),
  ('00000000-0000-4000-a000-000000000702', 'permit-q@kuruma.test', '{"full_name":"Permit Q","provider_id":"702"}');

select is((select permit_level from public.profiles where id = '00000000-0000-4000-a000-000000000701'), 1::smallint,
  'un nouveau joueur commence au niveau 1');

/* ---------- Expérience ---------- */

insert into public.pack_openings (user_id, pack_id)
  select '00000000-0000-4000-a000-000000000701', 'edition-01' from generate_series(1, 10);

select is(public.permit_xp('00000000-0000-4000-a000-000000000701'), 100, 'un pack ouvert rapporte 10 XP');
select is((select permit_level from public.profiles where id = '00000000-0000-4000-a000-000000000701'), 2::smallint,
  'le niveau suit aussitôt les packs ouverts');
select is(
  (select array_agg(level order by level) from public.notifications
   where user_id = '00000000-0000-4000-a000-000000000701' and kind = 'permit_up'),
  array[2::smallint],
  'le passage au niveau 2 est notifié'
);

insert into public.pack_openings (user_id, pack_id)
  select '00000000-0000-4000-a000-000000000701', 'edition-01' from generate_series(1, 40);

select is((select permit_level from public.profiles where id = '00000000-0000-4000-a000-000000000701'), 4::smallint,
  '500 XP : niveau 4');
select is(
  (select array_agg(level order by level) from public.notifications
   where user_id = '00000000-0000-4000-a000-000000000701' and kind = 'permit_up'),
  array[2, 3, 4]::smallint[],
  'chaque niveau franchi d''un coup a sa notification'
);

insert into public.pack_wallets (user_id, days) values ('00000000-0000-4000-a000-000000000701', 0);
update public.pack_wallets set days = 2 where user_id = '00000000-0000-4000-a000-000000000701';
select is(public.permit_xp('00000000-0000-4000-a000-000000000701'), 550, 'un jour de prime rapporte 25 XP');

insert into public.trades (from_id, to_id, status, resolved_at) values
  ('00000000-0000-4000-a000-000000000701', '00000000-0000-4000-a000-000000000702', 'accepted', now()),
  ('00000000-0000-4000-a000-000000000702', '00000000-0000-4000-a000-000000000701', 'accepted', now());
select is(public.permit_xp('00000000-0000-4000-a000-000000000701'), 570,
  'deux échanges avec le même joueur le même jour ne comptent qu''une fois');

/* ---------- Le niveau ne redescend jamais ---------- */

delete from public.pack_openings where user_id = '00000000-0000-4000-a000-000000000701';
select is(public.sync_permit('00000000-0000-4000-a000-000000000701'), 4::smallint,
  'perdre de l''expérience ne fait pas perdre de niveau');

/* ---------- Garage ---------- */

insert into public.cards (slug, tier, culture, traits, supply, minted) values
  ('zz-test-permit', 'common', 'Test', '{}', null, 8);
insert into public.card_copies (card_slug, serial, owner_id, obtained_via)
  select 'zz-test-permit', s, '00000000-0000-4000-a000-000000000701', 'pack' from generate_series(1, 8) s;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000701","role":"authenticated"}';

select throws_ok(
  $$ select public.set_garage(array(select id from public.card_copies where card_slug = 'zz-test-permit' order by serial limit 7)) $$,
  'P0001', 'garage is full',
  'au niveau 4, le garage garde 6 places'
);
select lives_ok(
  $$ select public.set_garage(array(select id from public.card_copies where card_slug = 'zz-test-permit' order by serial limit 6)) $$,
  'au niveau 4, 6 voitures passent'
);

reset role;
update public.profiles set permit_level = 10 where id = '00000000-0000-4000-a000-000000000701';
set local role authenticated;

select lives_ok(
  $$ select public.set_garage(array(select id from public.card_copies where card_slug = 'zz-test-permit' order by serial)) $$,
  'au niveau 10, 8 voitures passent'
);
select is((select count(*)::int from public.garage_slots where user_id = '00000000-0000-4000-a000-000000000701'), 8,
  'les 8 places sont occupées');

/* ---------- Boutique ---------- */

select is(
  (select bool_and(w.price = public.discounted(public.shop_price(c.tier), 10))
   from public.shop_window() w join public.cards c on c.slug = w.card_slug),
  true,
  'la vitrine affiche les prix avec 5 % de réduction au niveau 10'
);

reset role;
insert into public.cards (slug, tier, culture, traits, supply, minted) values
  ('zz-test-permit-used', 'rare', 'Test', '{}', null, 1);
insert into public.card_copies (id, card_slug, serial, owner_id, obtained_via) values
  ('00000000-0000-4000-b000-000000000701', 'zz-test-permit-used', 1, '00000000-0000-4000-a000-000000000702', 'pack');
insert into public.shop_stock (copy_id) values ('00000000-0000-4000-b000-000000000701');
select public.move_coins('00000000-0000-4000-a000-000000000701', 1000, 'daily', 'test');
set local role authenticated;

select public.buy_used('00000000-0000-4000-b000-000000000701');
select is(
  (select price from public.shop_purchases where copy_id = '00000000-0000-4000-b000-000000000701'),
  public.discounted(public.used_price('rare'), 10),
  'une occasion est payée au prix réduit'
);
select is((select coins from public.my_pack_wallet()), 1000 - public.discounted(public.used_price('rare'), 10),
  'seul le prix réduit est débité');

/* ---------- Cosmétiques et lecture ---------- */

select is(
  (select array_agg(cosmetic_id order by cosmetic_id) from public.my_cosmetics() where cosmetic_id in (
    'title-permis-b', 'frame-licence', 'badge-rallye', 'banner-speciale')),
  array['frame-licence', 'title-permis-b'],
  'le niveau 10 débloque le titre Permis B et le cadre Licence circuit, pas ceux du niveau 15'
);
select is(public.my_permit() ->> 'level', '10', 'my_permit renvoie le niveau du joueur');

select throws_ok(
  $$ select public.sync_permit('00000000-0000-4000-a000-000000000702') $$,
  '42501', null,
  'un joueur ne peut pas appeler sync_permit'
);
update public.profiles set permit_level = 30 where id = '00000000-0000-4000-a000-000000000701';
select is((select permit_level from public.profiles where id = '00000000-0000-4000-a000-000000000701'), 10::smallint,
  'un joueur ne peut pas changer son niveau lui-même');

set local role anon;
select throws_ok($$ select public.my_permit() $$, '42501', null, 'un visiteur ne peut pas appeler my_permit');

select * from finish();
rollback;
