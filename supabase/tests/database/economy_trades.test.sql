-- Échanges entre joueurs : création, réponse, échange atomique des copies,
-- offres concurrentes et copies qui ont changé de main entre-temps.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(45);

/* ---------- Jeu de données ---------- */
-- A propose, B répond, C sert de tiers.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-a000-000000000301', 'trade-a@kuruma.test', '{"full_name":"Trade A","provider_id":"301"}'),
  ('00000000-0000-4000-a000-000000000302', 'trade-b@kuruma.test', '{"full_name":"Trade B","provider_id":"302"}'),
  ('00000000-0000-4000-a000-000000000303', 'trade-c@kuruma.test', '{"full_name":"Trade C","provider_id":"303"}');

insert into public.cards (slug, tier, culture, traits, supply, minted) values
  ('zz-test-trade', 'common', 'Test', '{}', null, 16);

-- a1..a8 à A, b1..b7 à B, c1 à C.
insert into public.card_copies (id, card_slug, serial, owner_id, obtained_via)
select ('00000000-0000-4000-b000-0000000003' || lpad(n::text, 2, '0'))::uuid,
       'zz-test-trade', n,
       case when n <= 8 then '00000000-0000-4000-a000-000000000301'::uuid
            when n <= 15 then '00000000-0000-4000-a000-000000000302'::uuid
            else '00000000-0000-4000-a000-000000000303'::uuid end,
       'pack'
from generate_series(1, 16) n;
-- a1 = …0301 … a8 = …0308, b1 = …0309 … b7 = …0315, c1 = …0316

-- Comptes anciens : les règles de confiance sont testées dans economy_trust.
update public.profiles set created_at = now() - interval '60 days'
  where id in ('00000000-0000-4000-a000-000000000301', '00000000-0000-4000-a000-000000000302',
               '00000000-0000-4000-a000-000000000303');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

/* ---------- Création ---------- */

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000301","role":"authenticated"}';

select throws_ok(
  $$ select public.create_trade('00000000-0000-4000-a000-000000000301',
       array['00000000-0000-4000-b000-000000000301']::uuid[], array['00000000-0000-4000-b000-000000000302']::uuid[]) $$,
  'P0001', 'cannot trade with yourself',
  'on ne peut pas échanger avec soi-même'
);
select throws_ok(
  $$ select public.create_trade('00000000-0000-4000-a000-000000000302',
       '{}'::uuid[], array['00000000-0000-4000-b000-000000000309']::uuid[]) $$,
  'P0001', 'a trade has 1 to 5 cards on each side',
  'un échange donne au moins une carte'
);
select throws_ok(
  $$ select public.create_trade('00000000-0000-4000-a000-000000000302',
       array(select ('00000000-0000-4000-b000-0000000003' || lpad(n::text, 2, '0'))::uuid from generate_series(1, 6) n),
       array['00000000-0000-4000-b000-000000000309']::uuid[]) $$,
  'P0001', 'a trade has 1 to 5 cards on each side',
  'un échange donne au plus 5 cartes'
);
select throws_ok(
  $$ select public.create_trade('00000000-0000-4000-a000-000000000302',
       array['00000000-0000-4000-b000-000000000309']::uuid[], array['00000000-0000-4000-b000-000000000310']::uuid[]) $$,
  'P0001', 'cards changed hands',
  'on ne peut pas donner une copie qu''on n''a pas'
);
select throws_ok(
  $$ select public.create_trade('00000000-0000-4000-a000-000000000302',
       array['00000000-0000-4000-b000-000000000301']::uuid[], array['00000000-0000-4000-b000-000000000316']::uuid[]) $$,
  'P0001', 'cards changed hands',
  'on ne peut pas demander une copie que le destinataire n''a pas'
);
select throws_ok(
  $$ select public.create_trade('00000000-0000-4000-a000-000000000302',
       array['00000000-0000-4000-b000-000000000301', '00000000-0000-4000-b000-000000000301']::uuid[],
       array['00000000-0000-4000-b000-000000000309']::uuid[]) $$,
  'P0001', 'cards changed hands',
  'une même copie ne compte pas deux fois'
);

-- t1 : a1 contre b1.
insert into ids select 't1', public.create_trade('00000000-0000-4000-a000-000000000302',
  array['00000000-0000-4000-b000-000000000301']::uuid[], array['00000000-0000-4000-b000-000000000309']::uuid[]);

reset role;
select is((select status from public.trades where id = (select id from ids where name = 't1')), 'pending',
  'un nouvel échange est en attente');
select results_eq(
  $$ select copy_id, side from public.trade_items where trade_id = (select id from ids where name = 't1') order by side $$,
  $$ values ('00000000-0000-4000-b000-000000000301'::uuid, 'give'), ('00000000-0000-4000-b000-000000000309'::uuid, 'take') $$,
  'l''échange liste la copie donnée et la copie demandée'
);
select ok(
  exists (select 1 from public.notifications
          where user_id = '00000000-0000-4000-a000-000000000302' and kind = 'trade_received'
            and trade_id = (select id from ids where name = 't1')),
  'le destinataire est prévenu'
);
select is(
  (select owner_id from public.card_copies where id = '00000000-0000-4000-b000-000000000301'),
  '00000000-0000-4000-a000-000000000301'::uuid,
  'proposer un échange ne déplace aucune copie'
);

/* ---------- Seul le destinataire accepte ---------- */

set local role authenticated;
select throws_ok(
  format('select public.respond_trade(%L, true)', (select id from ids where name = 't1')),
  'P0001', 'not your trade',
  'l''auteur ne peut pas accepter sa propre offre'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000303","role":"authenticated"}';
select throws_ok(
  format('select public.respond_trade(%L, true)', (select id from ids where name = 't1')),
  'P0001', 'not your trade',
  'un tiers ne peut pas accepter l''échange'
);
select throws_ok(
  format('select public.respond_trade(%L, false)', (select id from ids where name = 't1')),
  'P0001', 'not your trade',
  'un tiers ne peut pas refuser l''échange'
);

/* ---------- Acceptation ---------- */

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000302","role":"authenticated"}';
select lives_ok(
  $$ select public.set_garage(array['00000000-0000-4000-b000-000000000309']::uuid[]) $$,
  'B expose b1 dans son garage'
);
select is(
  public.respond_trade((select id from ids where name = 't1'), true), 'accepted',
  'le destinataire accepte'
);

reset role;
select results_eq(
  $$ select id, owner_id, obtained_via from public.card_copies
     where id in ('00000000-0000-4000-b000-000000000301', '00000000-0000-4000-b000-000000000309') order by id $$,
  $$ values ('00000000-0000-4000-b000-000000000301'::uuid, '00000000-0000-4000-a000-000000000302'::uuid, 'trade'),
            ('00000000-0000-4000-b000-000000000309'::uuid, '00000000-0000-4000-a000-000000000301'::uuid, 'trade') $$,
  'les deux copies changent de main'
);
select is(
  (select count(*)::int from public.garage_slots where copy_id = '00000000-0000-4000-b000-000000000309'),
  0,
  'une copie échangée quitte le garage de son ancien propriétaire'
);
select ok(
  (select status = 'accepted' and resolved_at is not null from public.trades where id = (select id from ids where name = 't1')),
  'l''échange est marqué accepté'
);
select ok(
  exists (select 1 from public.notifications
          where user_id = '00000000-0000-4000-a000-000000000301' and kind = 'trade_accepted'),
  'l''auteur est prévenu de l''acceptation'
);

set local role authenticated;
select throws_ok(
  format('select public.respond_trade(%L, true)', (select id from ids where name = 't1')),
  'P0001', 'trade is not pending',
  'un échange accepté ne s''accepte pas deux fois'
);

/* ---------- Offres concurrentes sur la même copie ---------- */

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000301","role":"authenticated"}';
-- t2 : a2 contre b2 (à B) ; t3 : a2 contre c1 (à C).
insert into ids select 't2', public.create_trade('00000000-0000-4000-a000-000000000302',
  array['00000000-0000-4000-b000-000000000302']::uuid[], array['00000000-0000-4000-b000-000000000310']::uuid[]);
insert into ids select 't3', public.create_trade('00000000-0000-4000-a000-000000000303',
  array['00000000-0000-4000-b000-000000000302']::uuid[], array['00000000-0000-4000-b000-000000000316']::uuid[]);

select throws_ok(
  $$ select public.sell_copy('00000000-0000-4000-b000-000000000302') $$,
  'P0001', 'not sellable',
  'une copie proposée en échange ne peut pas être vendue à la boutique'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000302","role":"authenticated"}';
select is(public.respond_trade((select id from ids where name = 't2'), true), 'accepted',
  'B accepte la première offre sur a2');

reset role;
select is((select status from public.trades where id = (select id from ids where name = 't3')), 'expired',
  'l''offre concurrente sur a2 expire');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000303","role":"authenticated"}';
select throws_ok(
  format('select public.respond_trade(%L, true)', (select id from ids where name = 't3')),
  'P0001', 'trade is not pending',
  'l''offre expirée ne peut plus être acceptée'
);

reset role;
select is(
  (select owner_id from public.card_copies where id = '00000000-0000-4000-b000-000000000316'),
  '00000000-0000-4000-a000-000000000303'::uuid,
  'la copie de C reste à C'
);

/* ---------- Copie partie entre-temps ---------- */

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000301","role":"authenticated"}';
-- t4 : a3 contre b3, puis a3 change de main hors de l'échange.
insert into ids select 't4', public.create_trade('00000000-0000-4000-a000-000000000302',
  array['00000000-0000-4000-b000-000000000303']::uuid[], array['00000000-0000-4000-b000-000000000311']::uuid[]);

reset role;
update public.card_copies set owner_id = '00000000-0000-4000-a000-000000000303'
  where id = '00000000-0000-4000-b000-000000000303';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000302","role":"authenticated"}';
select is(public.respond_trade((select id from ids where name = 't4'), true), 'expired',
  'accepter un échange dont une copie a changé de main l''expire');

reset role;
select results_eq(
  $$ select id, owner_id from public.card_copies
     where id in ('00000000-0000-4000-b000-000000000303', '00000000-0000-4000-b000-000000000311') order by id $$,
  $$ values ('00000000-0000-4000-b000-000000000303'::uuid, '00000000-0000-4000-a000-000000000303'::uuid),
            ('00000000-0000-4000-b000-000000000311'::uuid, '00000000-0000-4000-a000-000000000302'::uuid) $$,
  'un échange expiré ne déplace aucune copie'
);
select is((select status from public.trades where id = (select id from ids where name = 't4')), 'expired',
  'l''échange est marqué expiré');

/* ---------- Annulation et refus ---------- */

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000301","role":"authenticated"}';
insert into ids select 't5', public.create_trade('00000000-0000-4000-a000-000000000302',
  array['00000000-0000-4000-b000-000000000304']::uuid[], array['00000000-0000-4000-b000-000000000312']::uuid[]);
select is(public.respond_trade((select id from ids where name = 't5'), false), 'cancelled',
  'l''auteur annule son offre');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000302","role":"authenticated"}';
select throws_ok(
  format('select public.respond_trade(%L, true)', (select id from ids where name = 't5')),
  'P0001', 'trade is not pending',
  'une offre annulée ne peut plus être acceptée'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000301","role":"authenticated"}';
insert into ids select 't6', public.create_trade('00000000-0000-4000-a000-000000000302',
  array['00000000-0000-4000-b000-000000000304']::uuid[], array['00000000-0000-4000-b000-000000000312']::uuid[]);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000302","role":"authenticated"}';
select is(public.respond_trade((select id from ids where name = 't6'), false), 'declined',
  'le destinataire refuse l''offre');

reset role;
select results_eq(
  $$ select id, owner_id from public.card_copies
     where id in ('00000000-0000-4000-b000-000000000304', '00000000-0000-4000-b000-000000000312') order by id $$,
  $$ values ('00000000-0000-4000-b000-000000000304'::uuid, '00000000-0000-4000-a000-000000000301'::uuid),
            ('00000000-0000-4000-b000-000000000312'::uuid, '00000000-0000-4000-a000-000000000302'::uuid) $$,
  'annuler ou refuser ne déplace aucune copie'
);
select ok(
  exists (select 1 from public.notifications
          where user_id = '00000000-0000-4000-a000-000000000302' and kind = 'trade_cancelled')
  and exists (select 1 from public.notifications
              where user_id = '00000000-0000-4000-a000-000000000301' and kind = 'trade_declined'),
  'annulation et refus sont notifiés à l''autre joueur'
);

/* ---------- Échange de plusieurs copies ---------- */

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000301","role":"authenticated"}';
-- t7 : a5 + a6 contre b5 + b6 + b7.
insert into ids select 't7', public.create_trade('00000000-0000-4000-a000-000000000302',
  array['00000000-0000-4000-b000-000000000305', '00000000-0000-4000-b000-000000000306']::uuid[],
  array['00000000-0000-4000-b000-000000000313', '00000000-0000-4000-b000-000000000314',
        '00000000-0000-4000-b000-000000000315']::uuid[]);

-- B vend b7 avant de répondre : la boutique le permet-elle ?
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000302","role":"authenticated"}';
select throws_ok(
  $$ select public.sell_copy('00000000-0000-4000-b000-000000000315') $$,
  'P0001', 'not sellable',
  'une copie demandée dans un échange en attente ne peut pas être vendue'
);
select is(public.respond_trade((select id from ids where name = 't7'), true), 'accepted',
  'B accepte l''échange à plusieurs cartes');

reset role;
select is(
  (select count(*)::int from public.card_copies
   where (id in ('00000000-0000-4000-b000-000000000305', '00000000-0000-4000-b000-000000000306')
          and owner_id = '00000000-0000-4000-a000-000000000302')
      or (id in ('00000000-0000-4000-b000-000000000313', '00000000-0000-4000-b000-000000000314',
                 '00000000-0000-4000-b000-000000000315')
          and owner_id = '00000000-0000-4000-a000-000000000301')),
  5,
  'toutes les copies d''un échange changent de main ensemble'
);

/* ---------- Copie supprimée d'un échange en attente ---------- */

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000301","role":"authenticated"}';
-- t8 : a7 contre c1 (A et C n'ont encore conclu aucun échange).
insert into ids select 't8', public.create_trade('00000000-0000-4000-a000-000000000303',
  array['00000000-0000-4000-b000-000000000307']::uuid[], array['00000000-0000-4000-b000-000000000316']::uuid[]);

reset role;
-- c1 disparaît (carte retirée du catalogue, compte supprimé…) : sa ligne
-- trade_items part avec elle (on delete cascade).
delete from public.card_copies where id = '00000000-0000-4000-b000-000000000316';

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000303","role":"authenticated"}';
select is(public.respond_trade((select id from ids where name = 't8'), true), 'expired',
  'un échange dont une copie a disparu expire');

reset role;
select is(
  (select owner_id from public.card_copies where id = '00000000-0000-4000-b000-000000000307'),
  '00000000-0000-4000-a000-000000000301'::uuid,
  'un échange dont une copie a disparu ne donne pas l''autre copie pour rien'
);

/* ---------- Écritures directes interdites ---------- */

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000303","role":"authenticated"}';
update public.card_copies set owner_id = '00000000-0000-4000-a000-000000000303'
  where id = '00000000-0000-4000-b000-000000000308';
update public.trades set status = 'accepted' where id = (select id from ids where name = 't5');

reset role;
select is(
  (select owner_id from public.card_copies where id = '00000000-0000-4000-b000-000000000308'),
  '00000000-0000-4000-a000-000000000301'::uuid,
  'un joueur ne peut pas s''attribuer une copie en écrivant dans la table'
);
select is(
  (select status from public.trades where id = (select id from ids where name = 't5')),
  'cancelled',
  'un joueur ne peut pas modifier un échange en écrivant dans la table'
);

/* ---------- Limite par paire ---------- */
-- A et B ont déjà conclu t1, t2 et t7 cette semaine.

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000301","role":"authenticated"}';
insert into ids select 't9', public.create_trade('00000000-0000-4000-a000-000000000302',
  array['00000000-0000-4000-b000-000000000308']::uuid[], array['00000000-0000-4000-b000-000000000312']::uuid[]);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000302","role":"authenticated"}';
select throws_ok(
  format('select public.respond_trade(%L, true)', (select id from ids where name = 't9')),
  'P0001', 'pair limit',
  'deux joueurs ne concluent pas plus de 3 échanges en 7 jours'
);
reset role;
select is((select status from public.trades where id = (select id from ids where name = 't9')), 'pending',
  'un échange bloqué par la limite reste en attente');

set local role authenticated;
select is(public.respond_trade((select id from ids where name = 't9'), null), 'declined',
  'une réponse vide vaut un refus, jamais une acceptation');
reset role;
select is(
  (select owner_id from public.card_copies where id = '00000000-0000-4000-b000-000000000308'),
  '00000000-0000-4000-a000-000000000301'::uuid,
  'une réponse vide ne déplace aucune copie'
);

/* ---------- Bilan ---------- */

select is(
  (select count(*)::int from public.card_copies where card_slug = 'zz-test-trade'),
  15,
  'les échanges ne créent ni ne détruisent de copies (16 moins c1 supprimée)'
);

select * from finish();
rollback;
