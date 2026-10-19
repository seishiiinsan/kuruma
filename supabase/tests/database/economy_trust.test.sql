-- Confiance : comptes trop récents, comptes bannis, échanges déséquilibrés
-- et limites par paire sur le marché (anti multi-comptes), marché ouvert
-- dès 10 boosters pendant le lancement.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(23);

/* ---------- Jeu de données ---------- */
-- O : ancien compte. N : créé aujourd'hui. Y : 10 jours. D : compte Discord
-- créé aujourd'hui. X : banni. B : acheteur ancien.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-a000-000000000601', 'trust-o@kuruma.test', '{"full_name":"Trust O","provider_id":"601"}'),
  ('00000000-0000-4000-a000-000000000602', 'trust-n@kuruma.test', '{"full_name":"Trust N","provider_id":"602"}'),
  ('00000000-0000-4000-a000-000000000603', 'trust-y@kuruma.test', '{"full_name":"Trust Y","provider_id":"603"}'),
  ('00000000-0000-4000-a000-000000000604', 'trust-d@kuruma.test',
    jsonb_build_object('full_name', 'Trust D',
      'provider_id', ((((extract(epoch from now()) * 1000)::bigint - 1420070400000) << 22))::text)),
  ('00000000-0000-4000-a000-000000000605', 'trust-x@kuruma.test', '{"full_name":"Trust X","provider_id":"605"}'),
  ('00000000-0000-4000-a000-000000000606', 'trust-b@kuruma.test', '{"full_name":"Trust B","provider_id":"606"}');

update public.profiles set created_at = now() - interval '60 days'
  where id in ('00000000-0000-4000-a000-000000000601', '00000000-0000-4000-a000-000000000604',
               '00000000-0000-4000-a000-000000000605', '00000000-0000-4000-a000-000000000606');
update public.profiles set created_at = now() - interval '10 days'
  where id = '00000000-0000-4000-a000-000000000603';
update public.profiles set banned_until = now() + interval '7 days'
  where id = '00000000-0000-4000-a000-000000000605';

insert into public.cards (slug, tier, culture, traits, supply, minted) values
  ('zz-test-trust', 'common', 'Test', '{}', null, 10),
  ('zz-test-trust-legend', 'legendary', 'Test', '{}', null, 1);

insert into public.card_copies (id, card_slug, serial, owner_id, obtained_via) values
  ('00000000-0000-4000-b000-000000000601', 'zz-test-trust', 1, '00000000-0000-4000-a000-000000000601', 'pack'),
  ('00000000-0000-4000-b000-000000000602', 'zz-test-trust', 2, '00000000-0000-4000-a000-000000000602', 'pack'),
  ('00000000-0000-4000-b000-000000000603', 'zz-test-trust', 3, '00000000-0000-4000-a000-000000000603', 'pack'),
  ('00000000-0000-4000-b000-000000000604', 'zz-test-trust', 4, '00000000-0000-4000-a000-000000000604', 'pack'),
  ('00000000-0000-4000-b000-000000000605', 'zz-test-trust', 5, '00000000-0000-4000-a000-000000000605', 'pack'),
  ('00000000-0000-4000-b000-000000000606', 'zz-test-trust', 6, '00000000-0000-4000-a000-000000000601', 'pack'),
  ('00000000-0000-4000-b000-000000000607', 'zz-test-trust', 7, '00000000-0000-4000-a000-000000000601', 'pack'),
  ('00000000-0000-4000-b000-000000000608', 'zz-test-trust', 8, '00000000-0000-4000-a000-000000000601', 'pack'),
  ('00000000-0000-4000-b000-000000000609', 'zz-test-trust', 9, '00000000-0000-4000-a000-000000000601', 'pack'),
  ('00000000-0000-4000-b000-000000000610', 'zz-test-trust-legend', 1, '00000000-0000-4000-a000-000000000601', 'pack');

select public.move_coins('00000000-0000-4000-a000-000000000606', 1000, 'daily', 'test');
select public.move_coins('00000000-0000-4000-a000-000000000602', 1000, 'daily', 'test');

/* ---------- Compte trop récent ---------- */

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000602","role":"authenticated"}';

select throws_ok(
  $$ select public.create_trade('00000000-0000-4000-a000-000000000601',
       array['00000000-0000-4000-b000-000000000602']::uuid[], array['00000000-0000-4000-b000-000000000601']::uuid[]) $$,
  'P0001', 'account too new',
  'un compte de moins de 3 jours ne propose pas d''échange'
);
select throws_ok(
  $$ select public.list_copy('00000000-0000-4000-b000-000000000602', 50) $$,
  'P0001', (select case when now() < public.launch_market_until() then 'launch packs' else 'account too new' end),
  'un compte de moins de 3 jours sans 10 boosters ne vend pas au marché'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000601","role":"authenticated"}';
select throws_ok(
  $$ select public.create_trade('00000000-0000-4000-a000-000000000602',
       array['00000000-0000-4000-b000-000000000601']::uuid[], array['00000000-0000-4000-b000-000000000602']::uuid[]) $$,
  'P0001', 'partner cannot trade',
  'on ne propose pas d''échange à un compte trop récent'
);
select lives_ok(
  $$ select public.list_copy('00000000-0000-4000-b000-000000000606', 50) $$,
  'un ancien compte met une copie en vente'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000602","role":"authenticated"}';
select throws_ok(
  $$ select public.buy_listing('00000000-0000-4000-b000-000000000606') $$,
  'P0001', (select case when now() < public.launch_market_until() then 'launch packs' else 'account too new' end),
  'un compte de moins de 3 jours sans 10 boosters n''achète pas au marché'
);

/* ---------- Discord trop récent, compte banni ---------- */

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000604","role":"authenticated"}';
select throws_ok(
  $$ select public.list_copy('00000000-0000-4000-b000-000000000604', 50) $$,
  'P0001', (select case when now() < public.launch_market_until() then 'launch packs' else 'discord too new' end),
  'un compte Discord de moins de 30 jours sans 10 boosters ne vend pas au marché'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000605","role":"authenticated"}';
select throws_ok(
  $$ select public.create_trade('00000000-0000-4000-a000-000000000601',
       array['00000000-0000-4000-b000-000000000605']::uuid[], array['00000000-0000-4000-b000-000000000601']::uuid[]) $$,
  'P0001', 'account banned',
  'un joueur banni ne propose pas d''échange'
);
select throws_ok(
  $$ select public.buy_listing('00000000-0000-4000-b000-000000000606') $$,
  'P0001', 'account banned',
  'un joueur banni n''achète pas au marché'
);

/* ---------- Échange déséquilibré avec un jeune compte ---------- */

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000601","role":"authenticated"}';
select throws_ok(
  $$ select public.create_trade('00000000-0000-4000-a000-000000000603',
       array['00000000-0000-4000-b000-000000000610']::uuid[], array['00000000-0000-4000-b000-000000000603']::uuid[]) $$,
  'P0001', 'unbalanced trade',
  'une légendaire contre une commune avec un compte de moins de 30 jours est refusée'
);
select lives_ok(
  $$ select public.create_trade('00000000-0000-4000-a000-000000000603',
       array['00000000-0000-4000-b000-000000000607']::uuid[], array['00000000-0000-4000-b000-000000000603']::uuid[]) $$,
  'une commune contre une commune avec un jeune compte reste possible'
);

/* ---------- Limite par paire au marché ---------- */
-- O vend 4 copies ; B en achète 3 dans la semaine, la 4e est refusée.

select lives_ok(
  $$ select public.list_copy(c, 50) from unnest(array['00000000-0000-4000-b000-000000000608',
       '00000000-0000-4000-b000-000000000609']::uuid[]) c $$,
  'O met deux autres copies en vente'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000606","role":"authenticated"}';
select lives_ok(
  $$ select public.buy_listing('00000000-0000-4000-b000-000000000606');
     select public.buy_listing('00000000-0000-4000-b000-000000000608');
     select public.buy_listing('00000000-0000-4000-b000-000000000609'); $$,
  'B achète trois copies à O'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000601","role":"authenticated"}';
select lives_ok(
  $$ select public.list_copy('00000000-0000-4000-b000-000000000601', 50) $$,
  'O met une quatrième copie en vente'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000606","role":"authenticated"}';
select throws_ok(
  $$ select public.buy_listing('00000000-0000-4000-b000-000000000601') $$,
  'P0001', 'pair limit',
  'un même acheteur ne conclut pas plus de 3 ventes avec le même vendeur en 7 jours'
);

/* ---------- Lancement : marché ouvert dès 10 boosters ---------- */
-- Dates fixes : le 25 octobre 2026 tombe dans le lancement, le 5 novembre après.

reset role;

select is(public.market_block('00000000-0000-4000-a000-000000000602', '2026-10-25'), 'launch packs',
  'pendant le lancement, un compte neuf sans booster ouvert attend ses 10 boosters');

insert into public.pack_openings (user_id, pack_id)
  select u, 'edition-01'
  from unnest(array['00000000-0000-4000-a000-000000000602', '00000000-0000-4000-a000-000000000604',
                    '00000000-0000-4000-a000-000000000605']::uuid[]) u,
       generate_series(1, 10);
insert into public.pack_openings (user_id, pack_id)
  select '00000000-0000-4000-a000-000000000603', 'edition-01' from generate_series(1, 9);

select is(public.market_block('00000000-0000-4000-a000-000000000602', '2026-10-25'), null,
  'pendant le lancement, 10 boosters ouverts ouvrent le marché à un compte neuf');
select is(public.market_block('00000000-0000-4000-a000-000000000604', '2026-10-25'), null,
  'pendant le lancement, 10 boosters ouverts suffisent aussi avec un compte Discord récent');
select is(public.market_block('00000000-0000-4000-a000-000000000602', '2026-11-05'), 'account too new',
  'après le lancement, un compte neuf attend de nouveau ses 3 jours');
select is(public.market_block('00000000-0000-4000-a000-000000000605', '2026-10-25'), 'account banned',
  'un joueur banni reste exclu du marché pendant le lancement');
select is(public.market_block('00000000-0000-4000-a000-000000000601', '2026-11-05'), null,
  'un ancien compte garde le marché après le lancement');
select is(public.trade_block('00000000-0000-4000-a000-000000000602'), 'account too new',
  'le lancement n''ouvre pas les échanges : seulement le marché');

update public.profiles set created_at = now() where id = '00000000-0000-4000-a000-000000000603';
select is(public.market_block('00000000-0000-4000-a000-000000000603', '2026-10-25'), 'launch packs',
  '9 boosters ne suffisent pas');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000602","role":"authenticated"}';
select is(
  (public.my_account() ->> 'market_block') is null,
  now() < public.launch_market_until(),
  'my_account indique si le marché est ouvert au joueur'
);

select * from finish();
rollback;
