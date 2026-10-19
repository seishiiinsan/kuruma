-- Export RGPD : export_my_data() ne renvoie que les données du joueur connecté.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

/* ---------- Jeu de données ---------- */
-- X exporte ; Y et Z ont leurs propres données, qui ne doivent pas sortir.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-a000-000000000501', 'export-x@kuruma.test', '{"full_name":"Export X","provider_id":"501"}'),
  ('00000000-0000-4000-a000-000000000502', 'export-y@kuruma.test', '{"full_name":"Export Y","provider_id":"502"}'),
  ('00000000-0000-4000-a000-000000000503', 'export-z@kuruma.test', '{"full_name":"Export Z","provider_id":"503"}');

insert into public.cards (slug, tier, culture, traits, supply, minted) values
  ('zz-test-export', 'common', 'Test', '{}', null, 5);

insert into public.card_copies (id, card_slug, serial, owner_id, obtained_via) values
  ('00000000-0000-4000-b000-000000000501', 'zz-test-export', 1, '00000000-0000-4000-a000-000000000501', 'pack'),
  ('00000000-0000-4000-b000-000000000502', 'zz-test-export', 2, '00000000-0000-4000-a000-000000000501', 'pack'),
  ('00000000-0000-4000-b000-000000000503', 'zz-test-export', 3, '00000000-0000-4000-a000-000000000502', 'pack'),
  ('00000000-0000-4000-b000-000000000504', 'zz-test-export', 4, '00000000-0000-4000-a000-000000000502', 'pack'),
  ('00000000-0000-4000-b000-000000000505', 'zz-test-export', 5, '00000000-0000-4000-a000-000000000503', 'pack');

select public.move_coins('00000000-0000-4000-a000-000000000501', 70, 'daily', 'export-x');
select public.move_coins('00000000-0000-4000-a000-000000000501', -20, 'shop', 'export-x');
select public.move_coins('00000000-0000-4000-a000-000000000502', 999, 'daily', 'export-y');

-- Un échange X → Y, et un échange Y → Z qui ne concerne pas X.
insert into public.trades (id, from_id, to_id) values
  ('00000000-0000-4000-c000-000000000501', '00000000-0000-4000-a000-000000000501', '00000000-0000-4000-a000-000000000502'),
  ('00000000-0000-4000-c000-000000000502', '00000000-0000-4000-a000-000000000502', '00000000-0000-4000-a000-000000000503');
insert into public.trade_items (trade_id, copy_id, side) values
  ('00000000-0000-4000-c000-000000000501', '00000000-0000-4000-b000-000000000501', 'give'),
  ('00000000-0000-4000-c000-000000000501', '00000000-0000-4000-b000-000000000503', 'take'),
  ('00000000-0000-4000-c000-000000000502', '00000000-0000-4000-b000-000000000504', 'give'),
  ('00000000-0000-4000-c000-000000000502', '00000000-0000-4000-b000-000000000505', 'take');

create temp table export (data jsonb);
grant all on export to authenticated;

/* ---------- Sans session ---------- */

set local role anon;
select throws_ok(
  $$ select public.export_my_data() $$,
  '42501', null,
  'un visiteur non connecté ne peut pas appeler export_my_data'
);

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated"}';
select throws_ok(
  $$ select public.export_my_data() $$,
  'P0001', 'not authenticated',
  'export_my_data refuse un appel sans joueur connecté'
);

/* ---------- Export de X ---------- */

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000501","role":"authenticated"}';
insert into export select public.export_my_data();
reset role;

select ok(
  (select data ?& array['profile', 'cards', 'coin_ledger', 'trades'] from export),
  'l''export contient profile, cards, coin_ledger et trades'
);
select is(
  (select data -> 'profile' ->> 'id' from export),
  '00000000-0000-4000-a000-000000000501',
  'le profil exporté est celui du joueur'
);
select is(
  (select array_agg(c ->> 'id' order by c ->> 'id') from export, jsonb_array_elements(data -> 'cards') c),
  array['00000000-0000-4000-b000-000000000501', '00000000-0000-4000-b000-000000000502'],
  'les cartes exportées sont exactement celles du joueur'
);
select ok(
  not exists (select 1 from export, jsonb_array_elements(data -> 'cards') c where c ? 'owner_id'),
  'les cartes exportées ne répètent pas owner_id'
);
select is(
  (select array_agg((l ->> 'amount')::int order by (l ->> 'id')::bigint)
   from export, jsonb_array_elements(data -> 'coin_ledger') l),
  array[70, -20],
  'le journal exporté ne contient que les mouvements du joueur'
);
select ok(
  not exists (select 1 from export, jsonb_array_elements(data -> 'coin_ledger') l where l ->> 'ref' = 'export-y'),
  'aucun mouvement de jetons d''un autre joueur ne sort'
);
select is(
  (select array_agg(t ->> 'id') from export, jsonb_array_elements(data -> 'trades') t),
  array['00000000-0000-4000-c000-000000000501'],
  'seuls les échanges auxquels le joueur prend part sont exportés'
);
select is(
  (select jsonb_array_length(t -> 'items') from export, jsonb_array_elements(data -> 'trades') t),
  2,
  'chaque échange exporté embarque ses copies'
);

select * from finish();
rollback;
