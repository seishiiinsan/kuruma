-- Amis : demande, acceptation, notifications, retrait, RLS et export.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(20);

/* ---------- Jeu de données ---------- */
-- A demande, B accepte, C regarde.

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-a000-000000000801', 'friend-a@kuruma.test', '{"full_name":"Friend A","provider_id":"801"}'),
  ('00000000-0000-4000-a000-000000000802', 'friend-b@kuruma.test', '{"full_name":"Friend B","provider_id":"802"}'),
  ('00000000-0000-4000-a000-000000000803', 'friend-c@kuruma.test', '{"full_name":"Friend C","provider_id":"803"}');

-- A tient une voiture : il entre au classement.
insert into public.cards (slug, tier, culture, traits, supply, minted) values
  ('zz-test-friends', 'common', 'Test', '{}', null, 1);
insert into public.card_copies (card_slug, serial, owner_id, obtained_via) values
  ('zz-test-friends', 1, '00000000-0000-4000-a000-000000000801', 'pack');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000801","role":"authenticated"}';

select throws_ok(
  $$ select public.add_friend('00000000-0000-4000-a000-000000000801') $$,
  'P0001', 'cannot befriend yourself',
  'on ne s''ajoute pas soi-même'
);
select is(public.add_friend('00000000-0000-4000-a000-000000000802'), 'pending', 'A demande B en ami');
select is(public.add_friend('00000000-0000-4000-a000-000000000802'), 'pending', 'redemander ne crée rien de plus');
select throws_ok(
  $$ insert into public.friendships (requester_id, addressee_id, status)
     values ('00000000-0000-4000-a000-000000000801', '00000000-0000-4000-a000-000000000803', 'accepted') $$,
  '42501', null,
  'un joueur n''écrit pas directement une amitié'
);

reset role;
select is(
  (select count(*)::int from public.notifications
   where user_id = '00000000-0000-4000-a000-000000000802' and kind = 'friend_request'
     and actor_id = '00000000-0000-4000-a000-000000000801'),
  1,
  'B reçoit une seule notification de demande'
);
set local role authenticated;

/* ---------- Acceptation ---------- */

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000802","role":"authenticated"}';
select is((select count(*)::int from public.friendships), 1, 'B voit la demande reçue');
select is(public.add_friend('00000000-0000-4000-a000-000000000801'), 'accepted',
  'ajouter celui qui nous a demandé accepte sa demande');
select is((select status from public.friendships), 'accepted', 'l''amitié est acceptée');

reset role;
select is(
  (select count(*)::int from public.notifications
   where user_id = '00000000-0000-4000-a000-000000000801' and kind = 'friend_accepted'),
  1,
  'A est prévenu que B a accepté'
);
select is((select count(*)::int from public.friendships), 1, 'une seule ligne par paire');
set local role authenticated;

/* ---------- Ce que voit un tiers ---------- */

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000803","role":"authenticated"}';
select is((select count(*)::int from public.friendships), 0, 'C ne voit pas les amitiés des autres');
select is(
  array(select public.player_friends('00000000-0000-4000-a000-000000000801')),
  array['00000000-0000-4000-a000-000000000802'::uuid],
  'C voit les amis de A sur son profil'
);
select lives_ok($$ select public.add_friend('00000000-0000-4000-a000-000000000801') $$, 'C demande A en ami');
select is(
  (select count(*)::int from public.player_friends('00000000-0000-4000-a000-000000000801')),
  1,
  'une demande en attente n''apparaît pas dans les amis'
);
select ok(
  exists(select 1 from public.leaderboard(1, array['00000000-0000-4000-a000-000000000801'::uuid])
         where user_id = '00000000-0000-4000-a000-000000000801'),
  'le classement inclut les amis demandés, quel que soit leur rang'
);

/* ---------- Export et retrait ---------- */

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000801","role":"authenticated"}';
select is(
  jsonb_array_length(public.export_my_data() -> 'friends'),
  2,
  'l''export des données contient l''amitié et la demande de C'
);

set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000802","role":"authenticated"}';
select lives_ok($$ select public.remove_friend('00000000-0000-4000-a000-000000000801') $$, 'B retire A de ses amis');
select is((select count(*)::int from public.friendships), 0, 'l''amitié a disparu');

set local role anon;
select throws_ok($$ select public.add_friend('00000000-0000-4000-a000-000000000801') $$, '42501', null,
  'un visiteur ne peut pas demander un ami');
select throws_ok($$ select public.player_friends('00000000-0000-4000-a000-000000000801') $$, '42501', null,
  'un visiteur ne voit pas les listes d''amis');

select * from finish();
rollback;
