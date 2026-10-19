-- Jeu de données de test : 48 joueurs factices (adresses @seed.kuruma.test)
-- qui ouvrent des boosters, complètent des séries, échangent, vendent au
-- marché et à la boutique, plus de quoi tester chaque écran depuis le compte
-- principal (le plus ancien compte réel) : échanges reçus et envoyés,
-- notifications de chaque sorte, séries et succès à réclamer, annonces, etc.
--
--   supabase db query --local -f scripts/seed/seed.sql
--   supabase db query --local -f scripts/seed/unseed.sql   (retire les joueurs factices)

begin;

do $$
begin
  if exists (select 1 from auth.users where email like '%@seed.kuruma.test') then
    raise exception 'Le jeu de test est déjà en base : lancer d''abord scripts/seed/unseed.sql';
  end if;
end $$;

select setseed(0.42);

create temp table seed_me on commit drop as
select id from auth.users where email not like '%@seed.kuruma.test' order by created_at limit 1;

do $$
begin
  if not exists (select 1 from seed_me) then
    raise exception 'Aucun compte réel : se connecter une fois au jeu avant de lancer le seed';
  end if;
end $$;

create temp table seed_t on commit drop as
select (public.paris_today()::timestamp at time zone 'Europe/Paris') as today;

/* ---------- Joueurs ---------- */

create temp table seed_users on commit drop as
select gen_random_uuid() as id, p.n, p.name, p.lvl, public.slugify_handle(p.name) as slug,
       now() - make_interval(secs => 86400 * case p.lvl
         when 'whale' then 50 + random() * 10
         when 'regular' then 20 + random() * 35
         when 'casual' then 3 + random() * 40
         else 0.05 + random() * 1.5 end) as created_at
from (values
  (1, 'Takumi Fujiwara', 'whale'), (2, 'Keisuke Takahashi', 'whale'), (3, 'Mlle Turbo', 'whale'),
  (4, 'Le Baron Rouge', 'whale'), (5, 'Nina Rotary', 'whale'), (6, 'Max Verstappoux', 'whale'),
  (7, 'Chloé Drift', 'regular'), (8, 'Rémi Boxer', 'regular'), (9, 'Yanis GTI', 'regular'),
  (10, 'Sofia Lancia', 'regular'), (11, 'Hugo V12', 'regular'), (12, 'Inès Carbu', 'regular'),
  (13, 'Bastien Kei', 'regular'), (14, 'Léa Mustang', 'regular'), (15, 'Nathan Rallye', 'regular'),
  (16, 'Camille Zonda', 'regular'), (17, 'Théo Skyline', 'regular'), (18, 'Manon 2CV', 'regular'),
  (19, 'Lucas Quattro', 'regular'), (20, 'Jade Testarossa', 'regular'), (21, 'Enzo Diablo', 'regular'),
  (22, 'Zoé Alpine', 'regular'), (23, 'Malik Supra', 'regular'), (24, 'Clara Coccinelle', 'regular'),
  (25, 'Adam Integrale', 'regular'), (26, 'Louise DS', 'regular'),
  (27, 'Paul Clio', 'casual'), (28, 'Emma Twingo', 'casual'), (29, 'Noah Golf', 'casual'),
  (30, 'Alice Méhari', 'casual'), (31, 'Gabriel 205', 'casual'), (32, 'Lina Fiat', 'casual'),
  (33, 'Jules Polo', 'casual'), (34, 'Rose Mini', 'casual'), (35, 'Arthur Rover', 'casual'),
  (36, 'Anna Saab', 'casual'), (37, 'Victor Volvo', 'casual'), (38, 'Mia Dacia', 'casual'),
  (39, 'Louis Simca', 'casual'), (40, 'Eva Panhard', 'casual'), (41, 'Raphaël Trabant', 'casual'),
  (42, 'Lou Lada', 'casual'), (43, 'Sacha Skoda', 'casual'), (44, 'Nour Citroën', 'casual'),
  (45, 'Novice Nicolas', 'new'), (46, 'Petit Pilote', 'new'), (47, 'Débutante Diane', 'new'),
  (48, 'Visiteur Vroum', 'new')
) as p (n, name, lvl);

-- The signup trigger creates each profile (and its waitlist entry).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at
)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated',
       u.slug || '@seed.kuruma.test', '', u.created_at, '', '', '', '',
       '{"provider": "discord", "providers": ["discord"]}',
       jsonb_build_object(
         'full_name', u.name, 'name', u.name, 'seed', true,
         'provider_id', (900000000000000000 + u.n * 7919)::text,
         'avatar_url', case when u.n % 3 = 0 then null
                            else 'https://cdn.discordapp.com/embed/avatars/' || (u.n % 6) || '.png' end),
       u.created_at, u.created_at, now() - random() * interval '3 days'
from seed_users u;

update public.profiles p set created_at = u.created_at, updated_at = u.created_at
from seed_users u where p.id = u.id;

/* ---------- Outils ---------- */

-- Mints one more copy of a car when its supply allows it.
create function pg_temp.give(p_user uuid, p_slug text, p_via text, p_at timestamptz)
returns uuid
language plpgsql
as $$
declare
  n int;
  cid uuid;
begin
  update public.cards set minted = minted + 1
    where slug = p_slug and (supply is null or minted < supply)
    returning minted into n;
  if n is null then
    return null;
  end if;
  insert into public.card_copies (card_slug, serial, owner_id, obtained_at, obtained_via)
    values (p_slug, n, p_user, p_at, p_via)
    returning id into cid;
  return cid;
end;
$$;

-- Copies a player can part with: duplicates, outside the garage, pending
-- trades, the market and the shop.
create function pg_temp.spare(p_user uuid)
returns setof uuid
language sql
as $$
  select c.id
  from public.card_copies c
  where c.owner_id = p_user
    and exists (select 1 from public.card_copies o where o.owner_id = p_user and o.card_slug = c.card_slug and o.id <> c.id)
    and not exists (select 1 from public.garage_slots g where g.copy_id = c.id)
    and not exists (
      select 1 from public.trade_items i join public.trades t on t.id = i.trade_id
      where i.copy_id = c.id and t.status = 'pending'
    );
$$;

-- About one car in ten is "popular": drawn six times as often, so duplicates,
-- trades and market prices pile up on the same cars.
create temp table seed_cards on commit drop as
select slug, tier, traits, supply, minted,
       case when get_byte(decode(md5(slug), 'hex'), 0) < 26 then 6.0 else 1.0 end as w
from public.cards;
create index on seed_cards (tier);

/* ---------- Boosters ouverts ---------- */

create temp table seed_open on commit drop as
select gen_random_uuid() as id, u.id as user_id, u.lvl,
       u.created_at + (now() - u.created_at) * sqrt(random()) as opened_at,
       null::text as pack_id
from seed_users u
cross join lateral generate_series(1, case u.lvl
  when 'whale' then 140 + (random() * 80)::int
  when 'regular' then 25 + (random() * 45)::int
  when 'casual' then 2 + (random() * 12)::int
  else (random() * 2)::int end) g;

-- The main player: three weeks of play, and a busy day today.
insert into seed_open
select gen_random_uuid(), m.id, 'me', t.today - random() * interval '21 days', null
from seed_me m, seed_t t, generate_series(1, 80);
insert into seed_open
select gen_random_uuid(), m.id, 'me', t.today + (now() - t.today) * random(), null
from seed_me m, seed_t t, generate_series(1, 14);

update seed_open o set pack_id = x.pack
from (
  select o2.id,
         case
           when extract(isodow from o2.opened_at at time zone 'Europe/Paris') >= 5 and random() < 0.35 then (
             select p.id from public.packs p
             where p.rotation = extract(week from o2.opened_at at time zone 'Europe/Paris')::int
                                % (select count(*) from public.packs where rotation is not null))
           when o2.lvl in ('whale', 'me') and random() < 0.05 then 'legende'
           else (array[
             'edition-01', 'edition-01', 'edition-01', 'edition-01', 'edition-01', 'edition-01', 'edition-01',
             'edition-01', 'nuit-jdm', 'nuit-jdm', 'nuit-jdm', 'garage-classique', 'garage-classique',
             'grand-tourisme', 'grand-tourisme', 'reve-americain', 'reve-americain', 'hors-piste',
             'tour-du-monde', 'prestige'])[1 + floor(random() * 20)::int]
         end as pack
  from seed_open o2
) x
where x.id = o.id;

-- Today the main player opened one Nuit JDM: its daily mission sits at 1/2.
update seed_open set pack_id = 'edition-01'
where lvl = 'me' and opened_at >= (select today from seed_t) and pack_id in ('nuit-jdm', 'legende');
update seed_open set pack_id = 'nuit-jdm'
where id = (select id from seed_open where lvl = 'me' and opened_at >= (select today from seed_t) order by opened_at limit 1);

create temp table seed_slot on commit drop as
select o.id as open_id, o.user_id, o.opened_at, p.themes,
       row_number() over () as k,
       case
         when x.r < (g.v -> 'odds' ->> 0)::numeric then 'common'
         when x.r < (g.v -> 'odds' ->> 0)::numeric + (g.v -> 'odds' ->> 1)::numeric then 'rare'
         when x.r < (g.v -> 'odds' ->> 0)::numeric + (g.v -> 'odds' ->> 1)::numeric + (g.v -> 'odds' ->> 2)::numeric then 'epic'
         else 'legendary'
       end as tier,
       cardinality(p.themes) > 0 and x.rt < p.theme_share as themed,
       null::text as slug
from seed_open o
join public.packs p on p.id = o.pack_id
cross join lateral jsonb_array_elements(p.slots) as g (v)
cross join lateral generate_series(1, (g.v ->> 'n')::int) as i
cross join lateral (select random() * 100 as r, random() as rt where o.id is not null and i > 0) x;

update seed_slot s set slug = (
  select c.slug from seed_cards c
  where c.tier = s.tier and c.traits && s.themes and (c.supply is null or c.minted < c.supply)
  order by -ln(greatest(random(), 1e-9)) / c.w
  limit 1)
where s.themed;

update seed_slot s set slug = (
  select c.slug from seed_cards c
  where c.tier = s.tier and (c.supply is null or c.minted < c.supply)
  order by -ln(greatest(random(), 1e-9)) / c.w
  limit 1)
where s.slug is null;

-- Serials in pull order; pulls past a car's supply are dropped, so the
-- rarest cars sell out.
create temp table seed_copy on commit drop as
select gen_random_uuid() as id, s.open_id, s.user_id, s.opened_at, s.k, s.slug,
       c.minted + row_number() over (partition by s.slug order by s.opened_at, s.k) as serial,
       c.supply
from seed_slot s join public.cards c on c.slug = s.slug;

delete from seed_copy where supply is not null and serial > supply;

insert into public.card_copies (id, card_slug, serial, owner_id, obtained_at, obtained_via)
select id, slug, serial, user_id, opened_at, 'pack' from seed_copy;

update public.cards c set minted = x.m
from (select slug, max(serial) as m from seed_copy group by slug) x
where x.slug = c.slug;

insert into public.pack_openings (id, user_id, pack_id, opened_at, copies)
select o.id, o.user_id, o.pack_id, o.opened_at,
       coalesce(array_agg(c.id order by c.k) filter (where c.id is not null), '{}')
from seed_open o left join seed_copy c on c.open_id = o.id
group by o.id, o.user_id, o.pack_id, o.opened_at;

/* ---------- Séries ---------- */

create temp table seed_target (role text, slug text) on commit drop;

do $$
declare
  u record;
  s record;
  m record;
  ok boolean;
  done int;
begin
  for u in select id, lvl from seed_users where lvl in ('whale', 'regular') loop
    done := 0;
    for s in
      select sc.series_id, count(*) filter (where o.card_slug is null) as missing
      from public.series_cards sc
      left join (select distinct card_slug from public.card_copies where owner_id = u.id) o on o.card_slug = sc.card_slug
      group by sc.series_id
      order by 2, random()
    loop
      exit when done >= case u.lvl when 'whale' then 4 else 1 end
             or s.missing > case u.lvl when 'whale' then 12 else 5 end;
      ok := true;
      for m in
        select sc.card_slug from public.series_cards sc
        where sc.series_id = s.series_id
          and not exists (select 1 from public.card_copies c where c.owner_id = u.id and c.card_slug = sc.card_slug)
      loop
        if pg_temp.give(u.id, m.card_slug, 'trade', now() - random() * interval '20 days') is null then
          ok := false;
        end if;
      end loop;
      if ok then
        insert into public.series_claims (user_id, series_id, claimed_at)
          values (u.id, s.series_id, now() - random() * interval '10 days');
        done := done + 1;
      end if;
    end loop;
  end loop;
end $$;

-- Main player: one series claimed, one complete and waiting to be claimed,
-- one missing a single car (wished for, on the market and in the shop).
do $$
declare
  me uuid := (select id from seed_me);
  s record;
  m record;
  ok boolean;
  step int := 0;
  missing_slug text;
begin
  for s in
    select sc.series_id, count(*) filter (where o.card_slug is null) as missing
    from public.series_cards sc
    left join (select distinct card_slug from public.card_copies where owner_id = me) o on o.card_slug = sc.card_slug
    where not exists (select 1 from public.series_claims c where c.user_id = me and c.series_id = sc.series_id)
    group by sc.series_id
    having count(*) filter (where o.card_slug is null) >= 1
    order by 2, random()
  loop
    exit when step >= 3;
    -- Every missing car must still have copies to mint.
    if exists (
      select 1 from public.series_cards sc join public.cards k on k.slug = sc.card_slug
      where sc.series_id = s.series_id and k.supply is not null and k.minted + 2 > k.supply
        and not exists (select 1 from public.card_copies c where c.owner_id = me and c.card_slug = sc.card_slug)
    ) then
      continue;
    end if;

    step := step + 1;
    missing_slug := null;
    if step = 3 then
      select sc.card_slug into missing_slug
      from public.series_cards sc join public.cards k on k.slug = sc.card_slug
      where sc.series_id = s.series_id
        and not exists (select 1 from public.card_copies c where c.owner_id = me and c.card_slug = sc.card_slug)
      order by array_position(array['legendary', 'epic', 'rare', 'common'], k.tier)
      limit 1;
      insert into seed_target values ('series_missing', missing_slug), ('series_almost', s.series_id);
    end if;

    ok := true;
    for m in
      select sc.card_slug from public.series_cards sc
      where sc.series_id = s.series_id and sc.card_slug is distinct from missing_slug
        and not exists (select 1 from public.card_copies c where c.owner_id = me and c.card_slug = sc.card_slug)
    loop
      if pg_temp.give(me, m.card_slug, 'trade', now() - random() * interval '6 days') is null then
        ok := false;
      end if;
    end loop;

    if step = 1 and ok then
      insert into public.series_claims (user_id, series_id, claimed_at) values (me, s.series_id, now() - interval '3 days');
    elsif step = 2 then
      insert into seed_target values ('series_claimable', s.series_id);
    end if;
  end loop;
end $$;

/* ---------- Boutique : vitrines passées et achats ---------- */

insert into public.shop_offers (period, slot, card_slug)
select d.day, (row_number() over (partition by d.day order by x.tier_rank, x.h) - 1)::smallint, x.slug
from (select to_char(public.paris_today() - g, 'YYYY-MM-DD') as day from generate_series(1, 14) g) d
cross join lateral (
  select c.slug,
         array_position(array['common', 'rare', 'epic'], c.tier) as tier_rank,
         md5(c.slug || d.day) as h,
         row_number() over (partition by c.tier order by md5(c.slug || d.day)) as n
  from public.cards c
  where c.tier in ('common', 'rare', 'epic') and (c.supply is null or c.minted < c.supply)
) x
where (x.tier_rank = 1 and x.n <= 3) or (x.tier_rank = 2 and x.n <= 2) or (x.tier_rank = 3 and x.n <= 1)
on conflict do nothing;

insert into public.shop_offers (period, slot, card_slug)
select w.week, 0, (
  select c.slug from public.cards c
  where c.tier = 'legendary' and (c.supply is null or c.minted < c.supply)
  order by md5(c.slug || w.week) limit 1)
from (select to_char((now() - make_interval(days => 7 * g)) at time zone 'Europe/Paris', 'IYYY-"W"IW') as week
      from generate_series(1, 3) g) w
on conflict do nothing;

do $$
declare
  o record;
  cid uuid;
  ts timestamptz;
  me uuid := (select id from seed_me);
  p record;
begin
  -- Window purchases on past days and weeks.
  for o in
    select distinct on (u.id, so.period, so.slot) u.id as uid, so.period, so.slot, so.card_slug, k.tier
    from seed_users u
    cross join lateral (
      select * from public.shop_offers s
      where s.period < to_char(now() at time zone 'Europe/Paris', 'YYYY-MM-DD') or s.period like '%W%'
      order by random() limit case u.lvl when 'whale' then 8 when 'regular' then 3 when 'casual' then 1 else 0 end
    ) so
    join public.cards k on k.slug = so.card_slug
    where so.period not in (select week from public.shop_periods())
  loop
    ts := case when o.period like '%W%'
               then now() - interval '7 days' - random() * interval '14 days'
               else o.period::date::timestamp at time zone 'Europe/Paris' + random() * interval '20 hours' end;
    cid := pg_temp.give(o.uid, o.card_slug, 'shop', ts);
    continue when cid is null;
    insert into public.shop_purchases (user_id, copy_id, card_slug, source, period, slot, price, created_at)
      values (o.uid, cid, o.card_slug, 'vitrine', o.period, o.slot, public.shop_price(o.tier), ts);
    insert into public.coin_ledger (user_id, amount, reason, ref, created_at)
      values (o.uid, -public.shop_price(o.tier), 'shop', o.card_slug, ts);
  end loop;

  -- Second-hand purchases.
  for o in
    select u.id as uid, c.slug, c.tier, now() - random() * interval '12 days' as ts
    from seed_users u
    cross join lateral (
      select slug, tier from seed_cards
      where tier in ('common', 'rare', 'epic') and u.id is not null
      order by random() limit case u.lvl when 'whale' then 4 when 'regular' then 2 else 0 end
    ) c
  loop
    cid := pg_temp.give(o.uid, o.slug, 'shop', o.ts);
    continue when cid is null;
    insert into public.shop_purchases (user_id, copy_id, card_slug, source, price, created_at)
      values (o.uid, cid, o.slug, 'occasion', public.used_price(o.tier), o.ts);
    insert into public.coin_ledger (user_id, amount, reason, ref, created_at)
      values (o.uid, -public.used_price(o.tier), 'shop', o.slug, o.ts);
  end loop;

  -- Main player: one of today's window cars, two second-hand cars.
  perform public.ensure_shop_offers();
  select * into p from public.shop_periods();
  select so.slot, so.card_slug, k.tier into o
  from public.shop_offers so join public.cards k on k.slug = so.card_slug
  where so.period = p.day and (k.supply is null or k.minted < k.supply)
    and not exists (
      select 1 from public.shop_purchases sp
      where sp.user_id = me and sp.source = 'vitrine' and sp.period = so.period and sp.slot = so.slot)
  order by so.slot limit 1;
  if found then
    cid := pg_temp.give(me, o.card_slug, 'shop', now() - interval '40 minutes');
    if cid is not null then
      insert into public.shop_purchases (user_id, copy_id, card_slug, source, period, slot, price, created_at)
        values (me, cid, o.card_slug, 'vitrine', p.day, o.slot, public.shop_price(o.tier), now() - interval '40 minutes');
      insert into public.coin_ledger (user_id, amount, reason, ref, created_at)
        values (me, -public.shop_price(o.tier), 'shop', o.card_slug, now() - interval '40 minutes');
    end if;
  end if;

  for o in select slug, tier from seed_cards where tier in ('rare', 'epic') order by random() limit 2 loop
    ts := now() - random() * interval '8 days';
    cid := pg_temp.give(me, o.slug, 'shop', ts);
    continue when cid is null;
    insert into public.shop_purchases (user_id, copy_id, card_slug, source, price, created_at)
      values (me, cid, o.slug, 'occasion', public.used_price(o.tier), ts);
    insert into public.coin_ledger (user_id, amount, reason, ref, created_at)
      values (me, -public.used_price(o.tier), 'shop', o.slug, ts);
  end loop;
end $$;

/* ---------- Échanges ---------- */

create function pg_temp.trade(
  p_from uuid, p_to uuid, p_give uuid[], p_take uuid[], p_status text, p_at timestamptz
)
returns uuid
language plpgsql
as $$
declare
  tid uuid;
  done_at timestamptz := case when p_status = 'pending' then null
                              else least(now(), p_at + random() * interval '20 hours') end;
begin
  insert into public.trades (from_id, to_id, status, created_at, resolved_at)
    values (p_from, p_to, p_status, p_at, done_at)
    returning id into tid;
  insert into public.trade_items (trade_id, copy_id, side)
    select tid, unnest(p_give), 'give'
    union all
    select tid, unnest(p_take), 'take';
  if p_status = 'accepted' then
    update public.card_copies c
      set owner_id = case i.side when 'give' then p_to else p_from end,
          obtained_at = done_at,
          obtained_via = 'trade'
      from public.trade_items i
      where i.trade_id = tid and i.copy_id = c.id;
  end if;
  return tid;
end;
$$;

-- Up to n copies a player held before a moment, spare ones first.
create function pg_temp.pick(p_user uuid, p_before timestamptz, n int, p_best boolean default false)
returns uuid[]
language sql
as $$
  select array_agg(id) from (
    select c.id
    from public.card_copies c join public.cards k on k.slug = c.card_slug
    where c.owner_id = p_user and c.obtained_at < p_before
      and not exists (
        select 1 from public.trade_items i join public.trades t on t.id = i.trade_id
        where i.copy_id = c.id and t.status = 'pending')
    order by c.id in (select pg_temp.spare(p_user)) desc,
             case when p_best then array_position(array['legendary', 'epic', 'rare', 'common'], k.tier) else 0 end,
             random()
    limit n
  ) x;
$$;

do $$
declare
  a record;
  b record;
  ts timestamptz;
  g uuid[];
  t uuid[];
  st text;
begin
  for i in 1..240 loop
    st := case
      when i <= 150 then 'accepted'
      when i <= 185 then 'declined'
      when i <= 210 then 'cancelled'
      when i <= 225 then 'expired'
      else 'pending' end;
    select id, created_at into a from seed_users where lvl <> 'new' order by random() limit 1;
    select id, created_at into b from seed_users where lvl <> 'new' and id <> a.id order by random() limit 1;
    ts := case when st = 'pending' then now() - random() * interval '3 days'
               else greatest(a.created_at, b.created_at) + random() * (now() - greatest(a.created_at, b.created_at)) end;
    g := pg_temp.pick(a.id, ts, 1 + floor(random() * 3)::int);
    t := pg_temp.pick(b.id, ts, 1 + floor(random() * 3)::int, random() < 0.4);
    continue when g is null or t is null;
    perform pg_temp.trade(a.id, b.id, g, t, st, ts);
  end loop;
end $$;

-- Main player: offers received and sent, and a history of each outcome.
do $$
declare
  me uuid := (select id from seed_me);
  s record;
  ts timestamptz;
  g uuid[];
  t uuid[];
  tid uuid;
  plan text[] := array[
    'in:pending', 'in:pending', 'in:pending', 'in:pending', 'in:pending', 'in:pending',
    'out:pending', 'out:pending', 'out:pending',
    'out:accepted', 'out:accepted', 'in:accepted', 'in:accepted',
    'out:declined', 'out:declined', 'in:cancelled', 'out:expired', 'in:declined'];
  dir text;
  st text;
  n int := 0;
begin
  foreach dir in array plan loop
    n := n + 1;
    st := split_part(dir, ':', 2);
    dir := split_part(dir, ':', 1);
    select id into s from seed_users where lvl in ('whale', 'regular') order by random() limit 1;
    ts := case
      when st = 'pending' and dir = 'out' then (select today from seed_t) + random() * (now() - (select today from seed_t))
      when st = 'pending' then now() - random() * interval '2 days'
      else now() - interval '1 day' - random() * interval '13 days' end;

    if dir = 'in' then
      -- They offer good cars for the main player's duplicates.
      g := pg_temp.pick(s.id, ts, 1 + floor(random() * 3)::int, true);
      t := pg_temp.pick(me, ts, 1 + floor(random() * 2)::int);
      continue when g is null or t is null;
      tid := pg_temp.trade(s.id, me, g, t, st, ts);
      insert into public.notifications (user_id, kind, actor_id, trade_id, created_at, read_at)
        values (me, 'trade_received', s.id, tid, ts, case when st = 'pending' and n > 2 then null else ts + interval '1 hour' end);
      if st = 'cancelled' then
        insert into public.notifications (user_id, kind, actor_id, trade_id, created_at, read_at)
          select me, 'trade_cancelled', s.id, tid, resolved_at, null from public.trades where id = tid;
      elsif st in ('accepted', 'declined') then
        insert into public.notifications (user_id, kind, actor_id, trade_id, created_at, read_at)
          select s.id, 'trade_' || st, me, tid, resolved_at, resolved_at from public.trades where id = tid;
      end if;
      insert into seed_target select 'trade_in', unnest(g)::text where st = 'pending';
    else
      g := pg_temp.pick(me, ts, 1 + floor(random() * 2)::int);
      t := pg_temp.pick(s.id, ts, 1 + floor(random() * 2)::int, random() < 0.5);
      continue when g is null or t is null;
      tid := pg_temp.trade(me, s.id, g, t, st, ts);
      insert into public.notifications (user_id, kind, actor_id, trade_id, created_at, read_at)
        values (s.id, 'trade_received', me, tid, ts, ts);
      if st in ('accepted', 'declined') then
        insert into public.notifications (user_id, kind, actor_id, trade_id, created_at, read_at)
          select me, 'trade_' || st, s.id, tid, resolved_at, case when n % 2 = 0 then null else resolved_at end
          from public.trades where id = tid;
      end if;
    end if;
  end loop;
end $$;

/* ---------- Listes de souhaits ---------- */

insert into public.wishes (user_id, card_slug, created_at)
select u.id, c.slug, now() - random() * (now() - u.created_at)
from seed_users u
cross join lateral (
  select sc.slug from seed_cards sc
  where u.id is not null
    and not exists (select 1 from public.card_copies cc where cc.owner_id = u.id and cc.card_slug = sc.slug)
  order by -ln(greatest(random(), 1e-9))
           / (sc.w * case sc.tier when 'legendary' then 8 when 'epic' then 4 when 'rare' then 1.5 else 1 end)
  limit case u.lvl when 'whale' then 25 + (random() * 30)::int when 'regular' then 8 + (random() * 20)::int
                   when 'casual' then (random() * 8)::int else 0 end
) c;

-- Main player: the car their series lacks, cars in today's window, cars
-- offered to them, and a few dream cars.
insert into public.wishes (user_id, card_slug, created_at)
select me.id, x.slug, now() - random() * interval '10 days'
from seed_me me,
lateral (
  select slug from seed_target where role = 'series_missing'
  union
  select o.card_slug from public.shop_offers o, public.shop_periods() p where o.period in (p.day, p.week)
  union
  (select c.card_slug from seed_target t join public.card_copies c on c.id::text = t.slug
   where t.role = 'trade_in' limit 4)
  union
  (select slug from seed_cards where tier in ('legendary', 'epic') order by -ln(greatest(random(), 1e-9)) / w limit 18)
) x
where not exists (select 1 from public.card_copies c where c.owner_id = me.id and c.card_slug = x.slug)
on conflict do nothing;

/* ---------- Occasions en boutique (doubles revendus) ---------- */

do $$
declare
  r record;
  ts timestamptz;
begin
  for r in
    select x.id, x.owner_id, x.card_slug, k.tier from (
      select c.id, c.owner_id, c.card_slug, row_number() over (order by random()) as rn,
             exists (select 1 from public.wishes w join seed_me m on m.id = w.user_id where w.card_slug = c.card_slug) as wished
      from public.card_copies c
      join seed_users u on u.id = c.owner_id
      where exists (select 1 from public.card_copies o where o.owner_id = c.owner_id and o.card_slug = c.card_slug and o.id <> c.id)
    ) x join public.cards k on k.slug = x.card_slug
    where x.rn <= 70 or (x.wished and x.rn <= 2000)
    limit 75
  loop
    -- Still a duplicate once earlier rows of this loop went to the shop?
    continue when r.id not in (select pg_temp.spare(r.owner_id));
    ts := now() - random() * interval '10 days';
    update public.card_copies set owner_id = null where id = r.id;
    insert into public.shop_stock (copy_id, listed_at) values (r.id, ts);
    insert into public.coin_ledger (user_id, amount, reason, ref, created_at)
      values (r.owner_id, public.sell_price(r.tier), 'sell', r.id::text, ts);
  end loop;
end $$;

-- Main player sold a dozen duplicates today.
do $$
declare
  me uuid := (select id from seed_me);
  r record;
begin
  for r in
    select c.id, k.tier from public.card_copies c join public.cards k on k.slug = c.card_slug
    where c.id in (select pg_temp.spare(me)) and k.tier = 'common'
    order by random() limit 12
  loop
    continue when r.id not in (select pg_temp.spare(me));
    update public.card_copies set owner_id = null where id = r.id;
    insert into public.shop_stock (copy_id) values (r.id);
    insert into public.coin_ledger (user_id, amount, reason, ref)
      values (me, public.sell_price(r.tier), 'sell', r.id::text);
  end loop;
end $$;

/* ---------- Marché : historique des ventes ---------- */

-- Cars with a price history: the most held, per rarity, plus the main
-- player's missing series car.
create temp table seed_hot on commit drop as
select slug, tier from (
  select k.slug, k.tier, row_number() over (partition by k.tier order by count(*) desc, k.slug) as rn
  from public.card_copies c join public.cards k on k.slug = c.card_slug
  where c.owner_id is not null
  group by k.slug, k.tier
) x
where rn <= case tier when 'common' then 6 when 'rare' then 12 when 'epic' then 12 else 8 end
union
select k.slug, k.tier from seed_target t join public.cards k on k.slug = t.slug where t.role = 'series_missing';

do $$
declare
  h record;
  base int;
  floor_price int;
  n int;
  ts timestamptz;
  price int;
  seller uuid;
  buyer uuid;
  cid uuid;
  phase double precision;
  trend double precision;
begin
  for h in select * from seed_hot loop
    select q.reference, q.min_price into base, floor_price from public.market_quote(h.slug) q;
    n := 8 + floor(random() * 35)::int;
    phase := random() * 6.28;
    trend := 0.6 * (random() - 0.4);
    for i in 1..n loop
      ts := now() - (power(random(), 2) * 90) * interval '1 day';
      price := greatest(floor_price, round(
        base * (0.8 + 0.4 * random())
             * (1 + 0.15 * sin(extract(epoch from ts) / 86400 / 9 + phase))
             * (1 + trend * (1 - extract(epoch from now() - ts) / 86400 / 90))
      )::int);
      select id into seller from seed_users where lvl <> 'new' and created_at < ts order by random() limit 1;
      select id into buyer from seed_users where lvl <> 'new' and created_at < ts and id is distinct from seller order by random() limit 1;
      continue when seller is null or buyer is null;
      select id into cid from public.card_copies where card_slug = h.slug order by random() limit 1;
      insert into public.market_sales (card_slug, copy_id, seller_id, buyer_id, price, fee, sold_at)
        values (h.slug, cid, seller, buyer, price, public.market_fee(price), ts);
      insert into public.coin_ledger (user_id, amount, reason, ref, created_at) values
        (buyer, -price, 'market', h.slug, ts),
        (seller, price - public.market_fee(price), 'market', h.slug, ts);
    end loop;
  end loop;
end $$;

-- Main player: three cars sold to other players, two bought from them.
do $$
declare
  me uuid := (select id from seed_me);
  r record;
  other uuid;
  ts timestamptz;
  q record;
  price int;
  n int := 0;
begin
  for r in
    select c.id, c.card_slug from public.card_copies c join public.cards k on k.slug = c.card_slug
    where c.id in (select pg_temp.spare(me)) and k.tier in ('rare', 'epic')
    order by random() limit 3
  loop
    n := n + 1;
    select id into other from seed_users where lvl in ('whale', 'regular') order by random() limit 1;
    ts := now() - random() * interval '5 days';
    select * into q from public.market_quote(r.card_slug);
    price := least(q.max_price, greatest(q.min_price, round(q.reference * (0.9 + random() * 0.4))::int));
    update public.card_copies set owner_id = other, obtained_at = ts, obtained_via = 'market' where id = r.id;
    insert into public.market_sales (card_slug, copy_id, seller_id, buyer_id, price, fee, sold_at)
      values (r.card_slug, r.id, me, other, price, public.market_fee(price), ts);
    insert into public.coin_ledger (user_id, amount, reason, ref, created_at) values
      (other, -price, 'market', r.card_slug, ts),
      (me, price - public.market_fee(price), 'market', r.card_slug, ts);
    insert into public.notifications (user_id, kind, actor_id, card_slug, created_at, read_at)
      values (me, 'market_sold', other, r.card_slug, ts, case when n = 1 then null else ts + interval '2 hours' end);
  end loop;

  for r in
    select c.id, c.card_slug, c.owner_id from public.card_copies c
    join seed_users u on u.id = c.owner_id and u.lvl in ('whale', 'regular')
    join seed_hot h on h.slug = c.card_slug
    where c.id in (select pg_temp.spare(c.owner_id))
      and not exists (select 1 from public.wishes w where w.user_id = me and w.card_slug = c.card_slug)
    order by random() limit 2
  loop
    ts := now() - random() * interval '6 days';
    select * into q from public.market_quote(r.card_slug);
    price := least(q.max_price, greatest(q.min_price, round(q.reference * (0.9 + random() * 0.3))::int));
    update public.card_copies set owner_id = me, obtained_at = ts, obtained_via = 'market' where id = r.id;
    insert into public.market_sales (card_slug, copy_id, seller_id, buyer_id, price, fee, sold_at)
      values (r.card_slug, r.id, r.owner_id, me, price, public.market_fee(price), ts);
    insert into public.coin_ledger (user_id, amount, reason, ref, created_at) values
      (me, -price, 'market', r.card_slug, ts),
      (r.owner_id, price - public.market_fee(price), 'market', r.card_slug, ts);
    insert into public.notifications (user_id, kind, actor_id, card_slug, created_at, read_at)
      values (r.owner_id, 'market_sold', me, r.card_slug, ts, ts);
  end loop;
end $$;

/* ---------- Marché : annonces en cours ---------- */

create function pg_temp.list(p_copy uuid, p_seller uuid, p_at timestamptz, p_spread double precision)
returns void
language plpgsql
as $$
declare
  v_slug text;
  q record;
  price int;
begin
  select card_slug into v_slug from public.card_copies where id = p_copy;
  select * into q from public.market_quote(v_slug);
  price := least(q.max_price, greatest(q.min_price, round(q.reference * (0.85 + random() * p_spread))::int));
  delete from public.garage_slots where copy_id = p_copy;
  update public.card_copies set owner_id = null where id = p_copy;
  insert into public.market_listings (copy_id, card_slug, seller_id, price, listed_at, expires_at)
    values (p_copy, v_slug, p_seller, price, p_at, p_at + interval '7 days');
  perform public.notify_wishers(v_slug, 'wish_market', p_seller);
end;
$$;

do $$
declare
  u record;
  r record;
begin
  for u in select id, lvl from seed_users where lvl <> 'new' loop
    for r in
      select c.id from public.card_copies c
      where c.id in (select pg_temp.spare(u.id))
      order by c.card_slug in (select slug from seed_hot) desc, random()
      limit case u.lvl when 'whale' then 8 + floor(random() * 12)::int
                       when 'regular' then 1 + floor(random() * 7)::int
                       else floor(random() * 2)::int end
    loop
      continue when r.id not in (select pg_temp.spare(u.id));
      -- A few listings run out within the hour.
      perform pg_temp.list(r.id, u.id,
        case when random() < 0.05 then now() - interval '7 days' + random() * interval '50 minutes'
             else now() - random() * interval '6 days 12 hours' end,
        0.9);
    end loop;
  end loop;

  -- The car the main player's series lacks is on sale, at two prices.
  for r in
    select c.id, c.owner_id from public.card_copies c
    join seed_target t on t.role = 'series_missing' and t.slug = c.card_slug
    join seed_users su on su.id = c.owner_id
    where not exists (select 1 from public.trade_items i join public.trades tr on tr.id = i.trade_id
                      where i.copy_id = c.id and tr.status = 'pending')
    limit 2
  loop
    perform pg_temp.list(r.id, r.owner_id, now() - random() * interval '2 days', 1.2);
  end loop;
end $$;

-- If nobody held that car, a whale pulls one and lists it.
do $$
declare
  v_slug text := (select slug from seed_target where role = 'series_missing');
  whale uuid := (select id from seed_users where lvl = 'whale' order by n limit 1);
  cid uuid;
begin
  if v_slug is not null and not exists (select 1 from public.market_listings where card_slug = v_slug) then
    cid := pg_temp.give(whale, v_slug, 'pack', now() - interval '3 days');
    if cid is not null then
      perform pg_temp.list(cid, whale, now() - interval '1 day', 0.9);
    end if;
  end if;
end $$;

-- Main player: four cars on sale, and one whose week ran out (it comes back
-- with a notification on the next visit).
do $$
declare
  me uuid := (select id from seed_me);
  r record;
  n int := 0;
begin
  for r in
    select c.id from public.card_copies c join public.cards k on k.slug = c.card_slug
    where c.id in (select pg_temp.spare(me))
    order by array_position(array['legendary', 'epic', 'rare', 'common'], k.tier), random()
    limit 5
  loop
    n := n + 1;
    if n = 5 then
      perform pg_temp.list(r.id, me, now() - interval '7 days 2 hours', 0.6);
    else
      perform pg_temp.list(r.id, me, now() - random() * interval '3 days', 0.6);
    end if;
  end loop;
end $$;

/* ---------- Garages ---------- */

insert into public.garage_slots (user_id, position, copy_id)
select user_id, (rn - 1)::smallint, id
from (
  select c.owner_id as user_id, c.id,
         row_number() over (
           partition by c.owner_id
           order by array_position(array['legendary', 'epic', 'rare', 'common'], k.tier), random()
         ) as rn
  from (
    select distinct on (owner_id, card_slug) id, owner_id, card_slug
    from public.card_copies
    where owner_id in (select id from seed_users where n % 7 <> 0)
    order by owner_id, card_slug, serial
  ) c
  join public.cards k on k.slug = c.card_slug
) x
where rn <= 6;

insert into public.garage_slots (user_id, position, copy_id)
select me.id, (rn - 1)::smallint, x.id
from seed_me me
cross join lateral (
  select c.id, row_number() over (order by array_position(array['legendary', 'epic', 'rare', 'common'], k.tier), c.serial) as rn
  from (select distinct on (card_slug) id, card_slug, serial from public.card_copies where owner_id = me.id order by card_slug, serial) c
  join public.cards k on k.slug = c.card_slug
) x
where x.rn <= 6 and not exists (select 1 from public.garage_slots g where g.user_id = me.id);

/* ---------- Bonus du jour, missions, portefeuilles ---------- */

create temp table seed_days on commit drop as
select u.id as user_id, d::date as day
from seed_users u
cross join lateral generate_series(
  (u.created_at at time zone 'Europe/Paris')::date, public.paris_today(), interval '1 day') d
where random() < case u.lvl when 'whale' then 0.95 when 'regular' then 0.8 when 'casual' then 0.35 else 0.6 end;

-- Half of them already took today's bonus.
delete from seed_days where day = public.paris_today() and random() < 0.5;

insert into public.coin_ledger (user_id, amount, reason, ref, created_at)
select user_id, 60 + 10 * floor(random() * 7)::int, 'daily', day::text,
       least(now(), day::timestamp at time zone 'Europe/Paris' + interval '7 hours' + random() * interval '14 hours')
from seed_days;

insert into public.mission_claims (user_id, period, mission_id, claimed_at)
select u.id, to_char(d, 'YYYY-MM-DD'), m.id, d + interval '20 hours'
from seed_users u
cross join generate_series(public.paris_today() - 7, public.paris_today() - 1, interval '1 day') d
cross join lateral (
  select id from public.missions where cadence = 'day' and u.id is not null and d is not null
  order by random() limit case u.lvl when 'whale' then 3 when 'regular' then 1 + floor(random() * 2)::int else 0 end
) m
where d::date >= (u.created_at at time zone 'Europe/Paris')::date;

insert into public.coin_ledger (user_id, amount, reason, created_at)
select c.user_id, m.reward, 'mission', c.claimed_at
from public.mission_claims c join public.missions m on m.id = c.mission_id
where c.user_id in (select id from seed_users);

insert into public.pack_wallets (user_id, stored, anchor_at, bonus, coins, daily_on, streak, days)
select u.id,
       floor(random() * 11)::smallint,
       now() - random() * interval '9 minutes',
       case u.lvl when 'whale' then floor(random() * 12)::int when 'regular' then floor(random() * 4)::int else 0 end,
       case u.lvl when 'whale' then 4000 + floor(random() * 30000)::int
                  when 'regular' then 300 + floor(random() * 5000)::int
                  when 'casual' then floor(random() * 900)::int
                  else 60 end,
       d.last_day,
       coalesce(d.streak, 0),
       coalesce(d.days, 0)
from seed_users u
left join lateral (
  select max(l.day) as last_day, count(*)::int as days,
         -- Days in a row up to the last one claimed.
         (select count(*)::int from (
            select l2.day, l2.day - (row_number() over (order by l2.day))::int as grp
            from seed_days l2 where l2.user_id = u.id
          ) z where z.grp = (
            select l3.day - (row_number() over (order by l3.day))::int
            from seed_days l3 where l3.user_id = u.id order by l3.day desc limit 1)) as streak
  from seed_days l where l.user_id = u.id
) d on true
on conflict (user_id) do nothing;

/* ---------- Succès des joueurs factices ---------- */

insert into public.achievement_claims (user_id, achievement_id, claimed_at)
select u.id, a.id, now() - random() * (now() - u.created_at)
from seed_users u
cross join lateral public.claimable_achievements(u.id) a
where u.lvl <> 'new';

insert into public.coin_ledger (user_id, amount, reason, created_at)
select c.user_id, a.reward, 'achievement', c.claimed_at
from public.achievement_claims c join public.achievements a on a.id = c.achievement_id
where c.user_id in (select id from seed_users);

/* ---------- Compte principal : de quoi tout tester ---------- */

update public.pack_wallets set coins = coins + 50000, bonus = bonus + 5
where user_id = (select id from seed_me);

-- Alerts on wished cars: in today's window, held twice by someone.
insert into public.notifications (user_id, kind, card_slug, created_at)
select w.user_id, 'wish_shop', w.card_slug, (select today from seed_t) + interval '1 minute'
from public.wishes w
join seed_me m on m.id = w.user_id
join public.shop_offers o on o.card_slug = w.card_slug
join public.shop_periods() p on o.period in (p.day, p.week)
where not exists (
  select 1 from public.notifications n
  where n.user_id = w.user_id and n.kind = 'wish_shop' and n.card_slug = w.card_slug and n.read_at is null);

insert into public.notifications (user_id, kind, actor_id, card_slug, created_at, read_at)
select distinct on (w.card_slug) w.user_id, 'wish_double', c.owner_id, w.card_slug,
       now() - random() * interval '4 days', null::timestamptz
from public.wishes w
join seed_me m on m.id = w.user_id
join public.card_copies c on c.card_slug = w.card_slug and c.owner_id in (select id from seed_users)
where (select count(*) from public.card_copies c2 where c2.owner_id = c.owner_id and c2.card_slug = w.card_slug) >= 2
  and not exists (
    select 1 from public.notifications n
    where n.user_id = w.user_id and n.kind = 'wish_double' and n.card_slug = w.card_slug and n.read_at is null)
limit 3;

-- Older alerts, already read.
update public.notifications set read_at = created_at + interval '30 minutes'
where user_id = (select id from seed_me) and kind like 'wish_%' and created_at < now() - interval '2 days';

commit;

/* ---------- Bilan ---------- */

select 'joueurs factices' as quoi, count(*)::text as combien from auth.users where email like '%@seed.kuruma.test'
union all select 'exemplaires', count(*)::text from public.card_copies
union all select 'boosters ouverts', count(*)::text from public.pack_openings
union all select 'séries réclamées', count(*)::text from public.series_claims
union all select 'échanges', string_agg(status || ' ' || n, ', ') from (select status, count(*) n from public.trades group by status) t
union all select 'annonces au marché', count(*)::text from public.market_listings
union all select 'ventes au marché', count(*)::text from public.market_sales
union all select 'occasions en boutique', count(*)::text from public.shop_stock
union all select 'achats boutique', count(*)::text from public.shop_purchases
union all select 'souhaits', count(*)::text from public.wishes
union all select 'notifications du compte principal', count(*)::text from public.notifications where user_id = (select id from auth.users where email not like '%@seed.kuruma.test' order by created_at limit 1)
union all select 'voitures épuisées', count(*)::text from public.cards where supply is not null and minted >= supply;
