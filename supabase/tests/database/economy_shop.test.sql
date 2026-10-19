-- Jetons et boutique : journal des jetons, bonus quotidien, revente de
-- doubles, occasions, vitrine du jour et écritures directes interdites.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(35);

/* ---------- Jeu de données ---------- */
-- U revend, V achète.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-a000-000000000401', 'shop-u@kuruma.test', '{"full_name":"Shop U","provider_id":"401"}'),
  ('00000000-0000-4000-a000-000000000402', 'shop-v@kuruma.test', '{"full_name":"Shop V","provider_id":"402"}');

insert into public.cards (slug, tier, culture, traits, supply, minted) values
  ('zz-test-shop', 'common', 'Test', '{}', null, 2),
  ('zz-test-shop-solo', 'rare', 'Test', '{}', null, 1);

insert into public.card_copies (id, card_slug, serial, owner_id, obtained_via) values
  ('00000000-0000-4000-b000-000000000401', 'zz-test-shop', 1, '00000000-0000-4000-a000-000000000401', 'pack'),
  ('00000000-0000-4000-b000-000000000402', 'zz-test-shop', 2, '00000000-0000-4000-a000-000000000401', 'pack'),
  ('00000000-0000-4000-b000-000000000403', 'zz-test-shop-solo', 1, '00000000-0000-4000-a000-000000000401', 'pack');

/* ---------- move_coins ---------- */

select is(public.move_coins('00000000-0000-4000-a000-000000000401', 30, 'daily', 'test'), 30,
  'move_coins crédite et renvoie le nouveau solde');
select throws_ok(
  $$ select public.move_coins('00000000-0000-4000-a000-000000000401', -31, 'shop', 'test') $$,
  'P0001', 'not enough coins',
  'move_coins refuse un solde négatif'
);
select is(public.move_coins('00000000-0000-4000-a000-000000000401', -30, 'shop', 'test'), 0,
  'move_coins peut vider le solde à 0');
select throws_ok(
  $$ select public.move_coins('00000000-0000-4000-a000-000000000401', 10, 'cadeau', 'test') $$,
  '23514', null,
  'un motif inconnu est refusé par le journal'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000401","role":"authenticated"}';

select throws_ok(
  $$ select public.move_coins('00000000-0000-4000-a000-000000000401', 1000, 'daily', 'triche') $$,
  '42501', null,
  'un joueur ne peut pas appeler move_coins'
);

/* ---------- Bonus quotidien ---------- */

select results_eq(
  $$ select reward, streak from public.claim_daily() $$,
  $$ values (60, 1) $$,
  'le premier bonus quotidien vaut 60 jetons'
);
select throws_ok(
  $$ select * from public.claim_daily() $$,
  'P0001', 'already claimed today',
  'le bonus quotidien ne se réclame qu''une fois par jour'
);
select is((select coins from public.my_pack_wallet()), 60, 'le bonus est crédité');

reset role;
insert into public.pack_wallets (user_id, daily_on, streak)
  values ('00000000-0000-4000-a000-000000000402', public.paris_today() - 1, 3);
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000402","role":"authenticated"}';

select results_eq(
  $$ select reward, streak from public.claim_daily() $$,
  $$ values (90, 4) $$,
  'un quatrième jour d''affilée rapporte 90 jetons'
);

/* ---------- Revente à la boutique ---------- */

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000401","role":"authenticated"}';

select throws_ok(
  $$ select public.sell_copy('00000000-0000-4000-b000-000000000403') $$,
  'P0001', 'not sellable',
  'on ne revend pas son unique copie d''une voiture'
);
select lives_ok(
  $$ select public.set_garage(array['00000000-0000-4000-b000-000000000401']::uuid[]) $$,
  'U expose une copie au garage'
);
select throws_ok(
  $$ select public.sell_copy('00000000-0000-4000-b000-000000000401') $$,
  'P0001', 'not sellable',
  'on ne revend pas une copie du garage'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000402","role":"authenticated"}';
select throws_ok(
  $$ select public.sell_copy('00000000-0000-4000-b000-000000000402') $$,
  'P0001', 'not your card',
  'on ne revend pas la copie d''un autre'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000401","role":"authenticated"}';
select is(public.sell_copy('00000000-0000-4000-b000-000000000402'), 2,
  'un double commun se revend 2 jetons');
select is((select coins from public.my_pack_wallet()), 62, 'le prix de revente est crédité');
select throws_ok(
  $$ select public.sell_copy('00000000-0000-4000-b000-000000000402') $$,
  'P0001', 'not your card',
  'une copie revendue ne se revend pas deux fois'
);

reset role;
select ok(
  (select owner_id is null from public.card_copies where id = '00000000-0000-4000-b000-000000000402')
  and exists (select 1 from public.shop_stock where copy_id = '00000000-0000-4000-b000-000000000402'),
  'la copie revendue part en stock d''occasion, sans propriétaire'
);

/* ---------- Occasions ---------- */

-- V repart de 49 jetons, juste sous le prix d'une occasion commune.
update public.pack_wallets set coins = 0 where user_id = '00000000-0000-4000-a000-000000000402';
delete from public.coin_ledger where user_id = '00000000-0000-4000-a000-000000000402';
select public.move_coins('00000000-0000-4000-a000-000000000402', 49, 'daily', 'test');
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000402","role":"authenticated"}';

select throws_ok(
  $$ select public.buy_used('00000000-0000-4000-b000-000000000402') $$,
  'P0001', 'not enough coins',
  'acheter une occasion sans assez de jetons est refusé'
);

reset role;
select ok(
  exists (select 1 from public.shop_stock where copy_id = '00000000-0000-4000-b000-000000000402')
  and (select owner_id is null from public.card_copies where id = '00000000-0000-4000-b000-000000000402'),
  'un achat d''occasion refusé laisse la copie en stock'
);
select public.move_coins('00000000-0000-4000-a000-000000000402', 1, 'daily', 'test');
set local role authenticated;

select lives_ok(
  $$ select public.buy_used('00000000-0000-4000-b000-000000000402') $$,
  'V achète l''occasion à 50 jetons'
);
select is((select coins from public.my_pack_wallet()), 0, 'l''occasion commune coûte 50 jetons');
select throws_ok(
  $$ select public.buy_used('00000000-0000-4000-b000-000000000402') $$,
  'P0001', 'no longer available',
  'une occasion ne se vend qu''une fois'
);

reset role;
select results_eq(
  $$ select owner_id, obtained_via from public.card_copies where id = '00000000-0000-4000-b000-000000000402' $$,
  $$ values ('00000000-0000-4000-a000-000000000402'::uuid, 'shop') $$,
  'l''occasion appartient à l''acheteur'
);
select is(
  (select count(*)::int from public.shop_stock where copy_id = '00000000-0000-4000-b000-000000000402'),
  0,
  'l''occasion vendue quitte le stock'
);

/* ---------- Vitrine du jour ---------- */

select public.move_coins('00000000-0000-4000-a000-000000000401', 10000, 'daily', 'test');
create temp table offer as
  select o.period, o.slot, o.card_slug, k.minted
  from public.shop_offers o join public.cards k on k.slug = o.card_slug
  where false;
grant all on offer to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000401","role":"authenticated"}';

insert into offer
  select w.period, w.slot, w.card_slug, k.minted
  from public.shop_window() w join public.cards k on k.slug = w.card_slug
  where w.period = (select day from public.shop_periods()) and not w.sold_out
  order by w.slot limit 1;

select is((select count(*)::int from offer), 1, 'la vitrine du jour propose une offre');

select lives_ok(
  format('select public.buy_offer(%L, %s)', (select period from offer), (select slot from offer)),
  'U achète l''offre de la vitrine'
);
select is(
  (select coins from public.my_pack_wallet()),
  10062 - (select public.shop_price(k.tier) from offer o join public.cards k on k.slug = o.card_slug),
  'l''offre est payée au prix de la boutique'
);
select throws_ok(
  format('select public.buy_offer(%L, %s)', (select period from offer), (select slot from offer)),
  'P0001', 'already bought',
  'une offre de la vitrine ne s''achète qu''une fois'
);
select throws_ok(
  $$ select public.buy_offer('2000-01-01', 0) $$,
  'P0001', 'offer expired',
  'une offre d''une période passée est refusée'
);

reset role;
select ok(
  (select k.minted = o.minted + 1 from offer o join public.cards k on k.slug = o.card_slug)
  and exists (
    select 1 from public.card_copies c join public.cards k on k.slug = c.card_slug
    join offer o on o.card_slug = c.card_slug
    where c.owner_id = '00000000-0000-4000-a000-000000000401' and c.obtained_via = 'shop' and c.serial = k.minted
  ),
  'l''offre achetée frappe une nouvelle copie au numéro suivant'
);

/* ---------- Écritures directes interdites ---------- */

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000402","role":"authenticated"}';

update public.pack_wallets set coins = 999999 where user_id = '00000000-0000-4000-a000-000000000402';
select is((select coins from public.my_pack_wallet()), 0, 'un joueur ne peut pas modifier son solde');

select throws_ok(
  $$ insert into public.coin_ledger (user_id, amount, reason) values ('00000000-0000-4000-a000-000000000402', 1000, 'daily') $$,
  '42501', null,
  'un joueur ne peut pas écrire dans le journal des jetons'
);
select throws_ok(
  $$ insert into public.card_copies (card_slug, serial, owner_id, obtained_via)
     values ('zz-test-shop', 99, '00000000-0000-4000-a000-000000000402', 'pack') $$,
  '42501', null,
  'un joueur ne peut pas se créer une copie'
);

/* ---------- Bilan ---------- */

reset role;
select is(
  (select count(*)::int from public.pack_wallets w
   where w.user_id in ('00000000-0000-4000-a000-000000000401', '00000000-0000-4000-a000-000000000402')
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
