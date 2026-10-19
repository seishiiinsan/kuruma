-- Economy: jetons, a soft currency earned and spent only in game (no real
-- money). Earned with tiered achievements, a daily bonus and by selling
-- duplicates; spent on extra packs, premium packs and cards in the shop.
-- Every number here must match lib/economy.ts and lib/packs.ts.

/* ---------- Jetons ---------- */

alter table public.pack_wallets
  add column coins int not null default 0 check (coins >= 0),
  add column daily_on date,
  add column streak int not null default 0,
  add column days int not null default 0;

create table public.coin_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount int not null,
  reason text not null check (reason in ('daily', 'achievement', 'sell', 'pack', 'shop')),
  ref text,
  created_at timestamptz not null default now()
);

create index coin_ledger_user_idx on public.coin_ledger (user_id, reason);

alter table public.coin_ledger enable row level security;
create policy "Players read their ledger" on public.coin_ledger
  for select to authenticated using ((select auth.uid()) = user_id);

-- Every jeton movement goes through here, and is logged.
create function public.move_coins(p_user uuid, p_amount int, p_reason text, p_ref text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  balance int;
begin
  insert into public.pack_wallets (user_id) values (p_user) on conflict do nothing;
  update public.pack_wallets set coins = coins + p_amount
    where user_id = p_user and coins + p_amount >= 0
    returning coins into balance;
  if not found then
    raise exception 'not enough coins' using errcode = 'P0001';
  end if;
  insert into public.coin_ledger (user_id, amount, reason, ref) values (p_user, p_amount, p_reason, p_ref);
  return balance;
end;
$$;

/* ---------- Prices (lib/economy.ts) ---------- */

create function public.shop_price(tier text)
returns int language sql immutable set search_path = ''
as $$ select case tier when 'common' then 80 when 'rare' then 200 when 'epic' then 700 else 2500 end; $$;

create function public.used_price(tier text)
returns int language sql immutable set search_path = ''
as $$ select case tier when 'common' then 50 when 'rare' then 120 when 'epic' then 420 else 1500 end; $$;

create function public.sell_price(tier text)
returns int language sql immutable set search_path = ''
as $$ select case tier when 'common' then 2 when 'rare' then 6 when 'epic' then 25 else 100 end; $$;

create function public.daily_reward(streak int)
returns int language sql immutable set search_path = ''
as $$ select 60 + 10 * (least(greatest(streak, 1), 7) - 1); $$;

create function public.paris_today()
returns date language sql stable set search_path = ''
as $$ select (now() at time zone 'Europe/Paris')::date; $$;

/* ---------- Packs: free, paid, premium ---------- */

-- slots: runs of identical slots, odds in % for common, rare, epic, legendary.
alter table public.packs
  add column free boolean not null default true,
  add column price int not null default 200 check (price > 0),
  add column slots jsonb not null default '[{"n":4,"odds":[60,28,9,3]},{"n":1,"odds":[0,75,19,6]}]',
  add column theme_weight int not null default 4 check (theme_weight >= 1);

insert into public.packs (id, name, themes, free, price, slots, theme_weight) values
  ('reve-americain', 'Rêve américain', '{US,Muscle}', true, 200,
    '[{"n":4,"odds":[60,28,9,3]},{"n":1,"odds":[0,75,19,6]}]', 4),
  ('hors-piste', 'Hors-piste', '{tout-terrain}', true, 200,
    '[{"n":4,"odds":[60,28,9,3]},{"n":1,"odds":[0,75,19,6]}]', 4),
  ('tour-du-monde', 'Tour du monde', '{Est,Corée,Monde,Kei}', false, 300,
    '[{"n":5,"odds":[60,28,9,3]},{"n":1,"odds":[0,75,19,6]}]', 6),
  ('prestige', 'Prestige', '{luxe,gt}', false, 450,
    '[{"n":4,"odds":[40,40,15,5]},{"n":1,"odds":[0,0,80,20]}]', 4),
  ('legende', 'Légende', '{}', false, 1200,
    '[{"n":2,"odds":[0,0,75,25]},{"n":1,"odds":[0,0,0,100]}]', 1);

alter table public.card_copies drop constraint card_copies_obtained_via_check;
alter table public.card_copies add constraint card_copies_obtained_via_check
  check (obtained_via in ('pack', 'trade', 'shop'));

drop function public.open_pack(text);

-- Free packs use timed packs, then bonus packs, unless p_pay; premium packs
-- always cost jetons.
create function public.open_pack(p_pack text, p_pay boolean default false)
returns table (copy_id uuid, card_slug text, serial int)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  pk public.packs;
  w public.pack_wallets;
  gained int;
  avail int;
  grp jsonb;
  odds jsonb;
  roll double precision;
  slot_tier text;
  pick text;
  minted_now int;
  new_copy uuid;
  pulled uuid[] := '{}';
  tiers text[] := array['common', 'rare', 'epic', 'legendary'];
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into pk from public.packs where id = p_pack;
  if not found then
    raise exception 'unknown pack';
  end if;

  insert into public.pack_wallets (user_id) values (uid) on conflict do nothing;
  select * into w from public.pack_wallets where user_id = uid for update;

  if pk.free and not p_pay then
    gained := floor(extract(epoch from (now() - w.anchor_at)) / 600)::int;
    avail := least(10, w.stored + gained);

    if avail >= 1 then
      if w.stored + gained >= 10 then
        update public.pack_wallets set stored = 9, anchor_at = now() where user_id = uid;
      else
        update public.pack_wallets
          set stored = avail - 1,
              anchor_at = w.anchor_at + make_interval(secs => gained * 600)
          where user_id = uid;
      end if;
    elsif w.bonus >= 1 then
      update public.pack_wallets set bonus = bonus - 1 where user_id = uid;
    else
      raise exception 'no packs available' using errcode = 'P0001';
    end if;
  else
    perform public.move_coins(uid, -pk.price, 'pack', pk.id);
  end if;

  for grp in select value from jsonb_array_elements(pk.slots) loop
    odds := grp -> 'odds';
    for i in 1..(grp ->> 'n')::int loop
      roll := random() * 100;
      slot_tier := case
        when roll < (odds ->> 0)::numeric then 'common'
        when roll < (odds ->> 0)::numeric + (odds ->> 1)::numeric then 'rare'
        when roll < (odds ->> 0)::numeric + (odds ->> 1)::numeric + (odds ->> 2)::numeric then 'epic'
        else 'legendary'
      end;

      pick := null;
      -- A sold-out tier falls back to the next tier down.
      for t in reverse array_position(tiers, slot_tier)..1 loop
        select c.slug into pick
        from public.cards c
        where c.tier = tiers[t] and (c.supply is null or c.minted < c.supply)
        order by -ln(greatest(random(), 1e-12))
                 / (case when c.traits && pk.themes then pk.theme_weight else 1 end)
        limit 1;
        exit when pick is not null;
      end loop;

      if pick is null then
        raise exception 'catalogue sold out';
      end if;

      update public.cards set minted = minted + 1 where slug = pick returning minted into minted_now;
      insert into public.card_copies (card_slug, serial, owner_id, obtained_via)
        values (pick, minted_now, uid, 'pack')
        returning id into new_copy;
      pulled := pulled || new_copy;

      copy_id := new_copy;
      card_slug := pick;
      serial := minted_now;
      return next;
    end loop;
  end loop;

  insert into public.pack_openings (user_id, pack_id, copies) values (uid, p_pack, pulled);
end;
$$;

/* ---------- Daily bonus: 60 jetons, +10 a day in a row, up to 120 ---------- */

create function public.claim_daily()
returns table (reward int, streak int)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  today date := public.paris_today();
  w public.pack_wallets;
  s int;
  r int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.pack_wallets (user_id) values (uid) on conflict do nothing;
  select * into w from public.pack_wallets where user_id = uid for update;

  if w.daily_on = today then
    raise exception 'already claimed today';
  end if;

  s := case when w.daily_on = today - 1 then w.streak + 1 else 1 end;
  r := public.daily_reward(s);
  update public.pack_wallets set daily_on = today, streak = s, days = days + 1 where user_id = uid;
  perform public.move_coins(uid, r, 'daily', today::text);

  reward := r;
  streak := s;
  return next;
end;
$$;

/* ---------- Shop: daily window, weekly legendary, second-hand copies ---------- */

-- Sold duplicates belong to nobody until another player buys them.
alter table public.card_copies alter column owner_id drop not null;

create table public.shop_offers (
  -- '2026-10-20' for the daily window, '2026-W43' for the weekly legendary.
  period text not null,
  slot smallint not null,
  card_slug text not null references public.cards (slug) on delete cascade,
  primary key (period, slot)
);

create table public.shop_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  copy_id uuid references public.card_copies (id) on delete set null,
  card_slug text not null references public.cards (slug) on delete cascade,
  source text not null check (source in ('vitrine', 'occasion')),
  period text,
  slot smallint,
  price int not null,
  created_at timestamptz not null default now()
);

create unique index shop_purchases_offer_idx on public.shop_purchases (user_id, period, slot)
  where source = 'vitrine';
create index shop_purchases_user_idx on public.shop_purchases (user_id);

create table public.shop_stock (
  copy_id uuid primary key references public.card_copies (id) on delete cascade,
  listed_at timestamptz not null default now()
);

create index shop_stock_listed_idx on public.shop_stock (listed_at desc);

alter table public.shop_offers enable row level security;
alter table public.shop_purchases enable row level security;
alter table public.shop_stock enable row level security;
create policy "Shop offers are public" on public.shop_offers for select to anon, authenticated using (true);
create policy "Shop stock is public" on public.shop_stock for select to anon, authenticated using (true);
create policy "Players read their purchases" on public.shop_purchases
  for select to authenticated using ((select auth.uid()) = user_id);

create function public.shop_periods(out day text, out week text)
language sql stable set search_path = ''
as $$
  select to_char(now() at time zone 'Europe/Paris', 'YYYY-MM-DD'),
         to_char(now() at time zone 'Europe/Paris', 'IYYY-"W"IW');
$$;

-- The same window for everyone, drawn from cars that still have copies to
-- mint: 3 commons, 2 rares and 1 epic a day, 1 legendary a week.
create function public.ensure_shop_offers()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
begin
  select * into p from public.shop_periods();
  if not exists (select 1 from public.shop_offers where period = p.day) then
    insert into public.shop_offers (period, slot, card_slug)
    select p.day, (row_number() over (order by x.tier_rank, x.h) - 1)::smallint, x.slug
    from (
      select c.slug,
             array_position(array['common', 'rare', 'epic'], c.tier) as tier_rank,
             md5(c.slug || p.day) as h,
             row_number() over (partition by c.tier order by md5(c.slug || p.day)) as n
      from public.cards c
      where c.tier in ('common', 'rare', 'epic') and (c.supply is null or c.minted < c.supply)
    ) x
    where (x.tier_rank = 1 and x.n <= 3) or (x.tier_rank = 2 and x.n <= 2) or (x.tier_rank = 3 and x.n <= 1)
    on conflict do nothing;
  end if;

  if not exists (select 1 from public.shop_offers where period = p.week) then
    insert into public.shop_offers (period, slot, card_slug)
    select p.week, 0, c.slug
    from public.cards c
    where c.tier = 'legendary' and (c.supply is null or c.minted < c.supply)
    order by md5(c.slug || p.week)
    limit 1
    on conflict do nothing;
  end if;
end;
$$;

create function public.shop_window()
returns table (period text, slot smallint, card_slug text, price int, bought boolean, sold_out boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  p record;
begin
  select * into p from public.shop_periods();
  perform public.ensure_shop_offers();
  return query
    select o.period, o.slot, o.card_slug, public.shop_price(c.tier),
           exists (
             select 1 from public.shop_purchases sp
             where sp.user_id = uid and sp.source = 'vitrine' and sp.period = o.period and sp.slot = o.slot
           ),
           c.supply is not null and c.minted >= c.supply
    from public.shop_offers o join public.cards c on c.slug = o.card_slug
    where o.period in (p.day, p.week)
    order by o.period = p.week, o.slot;
end;
$$;

create function public.buy_offer(p_period text, p_slot int)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  p record;
  v_slug text;
  k public.cards;
  cost int;
  n int;
  cid uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  select * into p from public.shop_periods();
  if p_period not in (p.day, p.week) then
    raise exception 'offer expired';
  end if;

  select o.card_slug into v_slug from public.shop_offers o where o.period = p_period and o.slot = p_slot;
  if not found then
    raise exception 'unknown offer';
  end if;
  if exists (
    select 1 from public.shop_purchases
    where user_id = uid and source = 'vitrine' and period = p_period and slot = p_slot
  ) then
    raise exception 'already bought';
  end if;

  select * into k from public.cards where cards.slug = v_slug for update;
  if k.supply is not null and k.minted >= k.supply then
    raise exception 'sold out';
  end if;

  cost := public.shop_price(k.tier);
  perform public.move_coins(uid, -cost, 'shop', k.slug);

  update public.cards set minted = minted + 1 where cards.slug = k.slug returning minted into n;
  insert into public.card_copies (card_slug, serial, owner_id, obtained_via)
    values (k.slug, n, uid, 'shop')
    returning id into cid;
  insert into public.shop_purchases (user_id, copy_id, card_slug, source, period, slot, price)
    values (uid, cid, k.slug, 'vitrine', p_period, p_slot, cost);
  return cid;
end;
$$;

create function public.buy_used(p_copy uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_slug text;
  v_tier text;
  cost int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select c.card_slug, k.tier into v_slug, v_tier
  from public.shop_stock s
  join public.card_copies c on c.id = s.copy_id
  join public.cards k on k.slug = c.card_slug
  where s.copy_id = p_copy
  for update of s, c;
  if not found then
    raise exception 'no longer available';
  end if;

  cost := public.used_price(v_tier);
  perform public.move_coins(uid, -cost, 'shop', v_slug);

  delete from public.shop_stock where copy_id = p_copy;
  update public.card_copies
    set owner_id = uid, obtained_at = now(), obtained_via = 'shop'
    where id = p_copy;
  insert into public.shop_purchases (user_id, copy_id, card_slug, source, price)
    values (uid, p_copy, v_slug, 'occasion', cost);
end;
$$;

-- A copy can be sold when the player keeps another copy of the car, and it
-- is neither in their garage nor in a pending trade.
create function public.sellable(p_copy uuid, p_user uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
           select 1 from public.card_copies c
           join public.card_copies other on other.card_slug = c.card_slug
             and other.owner_id = p_user and other.id <> c.id
           where c.id = p_copy and c.owner_id = p_user
         )
     and not exists (select 1 from public.garage_slots where copy_id = p_copy)
     and not exists (
           select 1 from public.trade_items i join public.trades t on t.id = i.trade_id
           where i.copy_id = p_copy and t.status = 'pending'
         );
$$;

create function public.sell_to_shop(p_copy uuid, p_user uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tier text;
  gain int;
begin
  select k.tier into v_tier
  from public.card_copies c join public.cards k on k.slug = c.card_slug
  where c.id = p_copy;
  gain := public.sell_price(v_tier);
  update public.card_copies set owner_id = null where id = p_copy;
  delete from public.garage_slots where copy_id = p_copy;
  insert into public.shop_stock (copy_id) values (p_copy);
  perform public.move_coins(p_user, gain, 'sell', p_copy::text);
  return gain;
end;
$$;

create function public.sell_copy(p_copy uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_slug text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select card_slug into v_slug from public.card_copies where id = p_copy and owner_id = uid;
  if not found then
    raise exception 'not your card';
  end if;
  -- Lock every copy of the car the player holds, so two sales can't take the last one.
  perform 1 from public.card_copies where card_slug = v_slug and owner_id = uid for update;

  if not public.sellable(p_copy, uid) then
    raise exception 'not sellable';
  end if;
  return public.sell_to_shop(p_copy, uid);
end;
$$;

-- Sells every duplicate of a rarity, keeping one copy of each car (the one in
-- the garage, else one no trade can take away, else the lowest number).
-- Copies in pending trades stay.
create function public.sell_duplicates(p_tier text)
returns table (sold int, gained int)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  r record;
  last_slug text;
  n int := 0;
  total int := 0;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  for r in
    select c.id, c.card_slug
    from public.card_copies c join public.cards k on k.slug = c.card_slug
    where c.owner_id = uid and k.tier = p_tier
    order by c.card_slug,
             exists (select 1 from public.garage_slots g where g.copy_id = c.id) desc,
             exists (
               select 1 from public.trade_items i join public.trades t on t.id = i.trade_id
               where i.copy_id = c.id and t.status = 'pending'
             ),
             c.serial
    for update of c
  loop
    if r.card_slug is distinct from last_slug then
      last_slug := r.card_slug;
      continue;
    end if;
    if public.sellable(r.id, uid) then
      total := total + public.sell_to_shop(r.id, uid);
      n := n + 1;
    end if;
  end loop;

  sold := n;
  gained := total;
  return next;
end;
$$;

/* ---------- Achievements ---------- */

create table public.achievements (
  id text primary key,
  metric text not null,
  goal int not null check (goal > 0),
  reward int not null check (reward > 0),
  unique (metric, goal)
);

create table public.achievement_claims (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null references public.achievements (id) on delete cascade,
  claimed_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.achievements enable row level security;
alter table public.achievement_claims enable row level security;
create policy "Achievements are public" on public.achievements for select to anon, authenticated using (true);
create policy "Achievement claims are public" on public.achievement_claims for select to anon, authenticated using (true);

insert into public.achievements (id, metric, goal, reward)
select metric || '-' || goal, metric, goal, reward
from (values
  ('cards', 10, 50), ('cards', 25, 80), ('cards', 50, 120), ('cards', 100, 200), ('cards', 250, 350),
  ('cards', 500, 600), ('cards', 1000, 1200), ('cards', 1500, 2000), ('cards', 2000, 3000),
  ('epics', 1, 50), ('epics', 5, 100), ('epics', 15, 250), ('epics', 40, 500), ('epics', 100, 1000), ('epics', 200, 2000),
  ('legendaries', 1, 150), ('legendaries', 3, 300), ('legendaries', 10, 600), ('legendaries', 25, 1200),
  ('legendaries', 50, 2500), ('legendaries', 100, 5000),
  ('packs', 1, 30), ('packs', 10, 80), ('packs', 50, 150), ('packs', 100, 250), ('packs', 250, 500),
  ('packs', 500, 800), ('packs', 1000, 1500),
  ('trades', 1, 100), ('trades', 5, 150), ('trades', 15, 300), ('trades', 40, 600), ('trades', 100, 1200),
  ('series', 1, 150), ('series', 3, 250), ('series', 10, 500), ('series', 25, 1000), ('series', 50, 2000), ('series', 100, 4000),
  ('cultures', 3, 40), ('cultures', 5, 80), ('cultures', 8, 250),
  ('serials', 1, 30), ('serials', 10, 80), ('serials', 50, 200), ('serials', 150, 500),
  ('score', 1000, 100), ('score', 5000, 250), ('score', 20000, 600), ('score', 50000, 1200), ('score', 100000, 2500),
  ('days', 3, 60), ('days', 7, 120), ('days', 30, 400), ('days', 100, 1200), ('days', 365, 4000),
  ('garage', 6, 80),
  ('sold', 10, 50), ('sold', 100, 150), ('sold', 500, 400),
  ('bought', 1, 50), ('bought', 10, 150), ('bought', 50, 400)
) as a (metric, goal, reward);

create function public.player_metrics(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with owned as (
    select distinct k.slug, k.tier, k.culture
    from public.card_copies c join public.cards k on k.slug = c.card_slug
    where c.owner_id = p_user
  )
  select jsonb_build_object(
    'cards', (select count(*) from owned),
    'epics', (select count(*) from owned where tier = 'epic'),
    'legendaries', (select count(*) from owned where tier = 'legendary'),
    'cultures', (select count(distinct culture) from owned),
    'score', coalesce((select sum(public.tier_points(tier)) from owned), 0)
             + coalesce((
                 select sum(s.points) from public.series_claims sc
                 join public.series s on s.id = sc.series_id
                 where sc.user_id = p_user
               ), 0),
    'serials', (select count(*) from public.card_copies where owner_id = p_user and serial = 1),
    'packs', (select count(*) from public.pack_openings where user_id = p_user),
    'trades', (select count(*) from public.trades where status = 'accepted' and p_user in (from_id, to_id)),
    'series', (select count(*) from public.series_claims where user_id = p_user),
    'garage', (select count(*) from public.garage_slots where user_id = p_user),
    'days', coalesce((select days from public.pack_wallets where user_id = p_user), 0),
    'sold', (select count(*) from public.coin_ledger where user_id = p_user and reason = 'sell'),
    'bought', (select count(*) from public.shop_purchases where user_id = p_user)
  );
$$;

create function public.claimable_achievements(p_user uuid)
returns setof public.achievements
language sql
stable
security definer
set search_path = ''
as $$
  with m as (select public.player_metrics(p_user) as v)
  select a.*
  from public.achievements a, m
  where coalesce((m.v ->> a.metric)::int, 0) >= a.goal
    and not exists (
      select 1 from public.achievement_claims ac where ac.user_id = p_user and ac.achievement_id = a.id
    )
  order by a.metric, a.goal;
$$;

create function public.my_metrics()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.player_metrics((select auth.uid()));
$$;

-- Claims every reached step at once; returns the jetons won.
create function public.claim_achievements()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  a public.achievements;
  total int := 0;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  for a in select * from public.claimable_achievements(uid) loop
    insert into public.achievement_claims (user_id, achievement_id) values (uid, a.id)
      on conflict do nothing;
    if found then
      total := total + a.reward;
    end if;
  end loop;

  if total > 0 then
    perform public.move_coins(uid, total, 'achievement', null);
  end if;
  return total;
end;
$$;

/* ---------- Wallet: packs, jetons, daily bonus, achievements to claim ---------- */

drop function public.my_pack_wallet();

create function public.my_pack_wallet()
returns table (
  available int,
  next_at timestamptz,
  bonus int,
  coins int,
  daily_ready boolean,
  streak int,
  claimable int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  today date := public.paris_today();
  w public.pack_wallets;
  gained int;
  avail int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.pack_wallets (user_id) values (uid) on conflict do nothing;
  select * into w from public.pack_wallets where user_id = uid;

  gained := floor(extract(epoch from (now() - w.anchor_at)) / 600)::int;
  avail := least(10, w.stored + gained);

  return query select
    avail,
    case
      when avail >= 10 then null
      else w.anchor_at + make_interval(secs => (gained + 1) * 600)
    end,
    w.bonus,
    w.coins,
    w.daily_on is distinct from today,
    case when w.daily_on >= today - 1 then w.streak else 0 end,
    (select count(*)::int from public.claimable_achievements(uid));
end;
$$;

/* ---------- Grants ---------- */

revoke execute on function public.move_coins(uuid, int, text, text) from public, anon, authenticated;
revoke execute on function public.ensure_shop_offers() from public, anon, authenticated;
revoke execute on function public.sellable(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.sell_to_shop(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.player_metrics(uuid) from public, anon, authenticated;
revoke execute on function public.claimable_achievements(uuid) from public, anon, authenticated;

revoke execute on function public.open_pack(text, boolean) from public, anon;
revoke execute on function public.claim_daily() from public, anon;
revoke execute on function public.shop_window() from public, anon;
revoke execute on function public.buy_offer(text, int) from public, anon;
revoke execute on function public.buy_used(uuid) from public, anon;
revoke execute on function public.sell_copy(uuid) from public, anon;
revoke execute on function public.sell_duplicates(text) from public, anon;
revoke execute on function public.my_metrics() from public, anon;
revoke execute on function public.claim_achievements() from public, anon;
revoke execute on function public.my_pack_wallet() from public, anon;

grant execute on function public.open_pack(text, boolean) to authenticated;
grant execute on function public.claim_daily() to authenticated;
grant execute on function public.shop_window() to authenticated;
grant execute on function public.buy_offer(text, int) to authenticated;
grant execute on function public.buy_used(uuid) to authenticated;
grant execute on function public.sell_copy(uuid) to authenticated;
grant execute on function public.sell_duplicates(text) to authenticated;
grant execute on function public.my_metrics() to authenticated;
grant execute on function public.claim_achievements() to authenticated;
grant execute on function public.my_pack_wallet() to authenticated;
