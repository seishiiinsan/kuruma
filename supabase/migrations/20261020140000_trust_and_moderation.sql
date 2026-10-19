-- Trust and moderation.
--
-- Multiple accounts: a player could farm free packs on spare Discord
-- accounts, then pass cards and jetons to a main account through lopsided
-- trades or market sales. Cards and jetons only reach another player when:
-- - the Kuruma account is at least 3 days old, and the Discord account at
--   least 30 days old (read from the Discord id, a snowflake that dates it);
-- - the player proposed under 10 trades and concluded under 10 in 24 h, and
--   bought under 10 cars on the market in 24 h;
-- - the same two players concluded under 3 trades, and under 3 market sales,
--   in 7 days;
-- - while either side is under 30 days old, the two sides of a trade stay
--   within 3x of each other at the quote;
-- - market listings start at half the quote (no more car at the buy-back
--   price for a friend to pick up).
-- Every number here must match lib/trust.ts and lib/market.ts.
--
-- Moderation: admins (public.admins, filled by hand in SQL) ban players,
-- revert a trade or a market sale, correct a balance and handle reports.
-- Every admin action lands in public.moderation_log.

/* ---------- Columns and new values ---------- */

alter table public.profiles
  add column banned_until timestamptz,
  add column ban_reason text;
-- Not granted to anon or authenticated: profiles are readable column by
-- column, and these stay private (read through my_account / admin_player).

alter table public.trades drop constraint trades_status_check;
alter table public.trades add constraint trades_status_check
  check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired', 'reverted'));

alter table public.market_sales add column reverted_at timestamptz;

alter table public.coin_ledger drop constraint coin_ledger_reason_check;
alter table public.coin_ledger add constraint coin_ledger_reason_check
  check (reason in ('daily', 'achievement', 'sell', 'pack', 'shop', 'mission', 'market', 'cosmetic', 'salon', 'admin'));

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in (
    'trade_received', 'trade_accepted', 'trade_declined', 'trade_cancelled',
    'wish_shop', 'wish_used', 'wish_double', 'wish_market',
    'market_sold', 'market_expired', 'moderation'
  ));

create index trades_resolved_idx on public.trades (resolved_at) where status = 'accepted';
create index market_sales_buyer_idx on public.market_sales (buyer_id, sold_at desc);

/* ---------- Trust ---------- */

-- When a Discord account was created, from its id.
create function public.discord_created_at(p_discord_id text)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select case when p_discord_id ~ '^[0-9]{15,19}$'
              then to_timestamp(((p_discord_id::bigint >> 22) + 1420070400000) / 1000.0) end;
$$;

-- Why a player can't pass cards or jetons to others yet; null when they can.
create function public.trade_block(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.id is null then 'not authenticated'
    when p.banned_until > now() then 'account banned'
    when p.created_at > now() - interval '3 days' then 'account too new'
    when public.discord_created_at(p.discord_id) > now() - interval '30 days' then 'discord too new'
  end
  from (select 1) one
  left join public.profiles p on p.id = p_user;
$$;

-- From when a player may trade (null for banned players).
create function public.trade_from(p_user uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select case when p.banned_until > now() then null
              else greatest(p.created_at + interval '3 days',
                            coalesce(public.discord_created_at(p.discord_id) + interval '30 days', p.created_at)) end
  from public.profiles p
  where p.id = p_user;
$$;

create function public.assert_trusted(p_user uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  reason text := public.trade_block(p_user);
begin
  if reason is not null then
    raise exception '%', reason using errcode = 'P0001';
  end if;
end;
$$;

-- Accepted trades of a player in the last 24 h.
create function public.trades_today(p_user uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.trades
  where status = 'accepted' and p_user in (from_id, to_id) and resolved_at > now() - interval '1 day';
$$;

-- Sum of the quotes of some copies.
create function public.copies_value(p_copies uuid[])
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(q.reference), 0)::bigint
  from public.card_copies c
  cross join lateral public.market_quote(c.card_slug) q
  where c.id = any (p_copies);
$$;

/* ---------- Trades ---------- */

create or replace function public.create_trade(p_to uuid, p_give uuid[], p_take uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  tid uuid;
  give_value bigint;
  take_value bigint;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_to is null or p_to = uid then
    raise exception 'cannot trade with yourself';
  end if;
  if coalesce(array_length(p_give, 1), 0) not between 1 and 5
     or coalesce(array_length(p_take, 1), 0) not between 1 and 5 then
    raise exception 'a trade has 1 to 5 cards on each side';
  end if;
  if (select count(*) from public.card_copies where id = any (p_give) and owner_id = uid) <> array_length(p_give, 1)
     or (select count(*) from public.card_copies where id = any (p_take) and owner_id = p_to) <> array_length(p_take, 1) then
    raise exception 'cards changed hands';
  end if;

  perform public.assert_trusted(uid);
  if public.trade_block(p_to) is not null then
    raise exception 'partner cannot trade';
  end if;
  if (select count(*) from public.trades where from_id = uid and status = 'pending') >= 20 then
    raise exception 'too many pending trades';
  end if;
  if (select count(*) from public.trades where from_id = uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'daily trade limit';
  end if;

  -- Young accounts: no gift dressed up as a trade.
  if exists (select 1 from public.profiles where id in (uid, p_to) and created_at > now() - interval '30 days') then
    give_value := public.copies_value(p_give);
    take_value := public.copies_value(p_take);
    if greatest(give_value, take_value) > 3 * greatest(least(give_value, take_value), 1) then
      raise exception 'unbalanced trade';
    end if;
  end if;

  insert into public.trades (from_id, to_id) values (uid, p_to) returning id into tid;
  insert into public.trade_items (trade_id, copy_id, side)
    select tid, unnest(p_give), 'give'
    union all
    select tid, unnest(p_take), 'take';
  insert into public.notifications (user_id, kind, actor_id, trade_id)
    values (p_to, 'trade_received', uid, tid);
  return tid;
end;
$$;

create or replace function public.respond_trade(p_trade uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  accept boolean := coalesce(p_accept, false);
  t public.trades;
  valid boolean;
  moved uuid[];
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into t from public.trades where id = p_trade for update;
  if not found or t.status <> 'pending' then
    raise exception 'trade is not pending';
  end if;

  if uid = t.from_id and not accept then
    update public.trades set status = 'cancelled', resolved_at = now() where id = p_trade;
    insert into public.notifications (user_id, kind, actor_id, trade_id)
      values (t.to_id, 'trade_cancelled', uid, p_trade);
    return 'cancelled';
  end if;

  if uid is distinct from t.to_id then
    raise exception 'not your trade';
  end if;

  if not accept then
    update public.trades set status = 'declined', resolved_at = now() where id = p_trade;
    insert into public.notifications (user_id, kind, actor_id, trade_id)
      values (t.from_id, 'trade_declined', uid, p_trade);
    return 'declined';
  end if;

  perform public.assert_trusted(uid);
  if public.trade_block(t.from_id) is not null then
    raise exception 'partner cannot trade';
  end if;
  if public.trades_today(uid) >= 10 or public.trades_today(t.from_id) >= 10 then
    raise exception 'daily trade limit';
  end if;
  if (
    select count(*) from public.trades
    where status = 'accepted' and resolved_at > now() - interval '7 days'
      and ((from_id = t.from_id and to_id = t.to_id) or (from_id = t.to_id and to_id = t.from_id))
  ) >= 3 then
    raise exception 'pair limit';
  end if;

  -- Lock every copy in the trade, then check nobody traded them away since.
  perform 1 from public.card_copies c
    join public.trade_items i on i.copy_id = c.id
    where i.trade_id = p_trade
    for update of c;

  select bool_and(
    (i.side = 'give' and c.owner_id = t.from_id) or (i.side = 'take' and c.owner_id = t.to_id)
  ) into valid
  from public.trade_items i join public.card_copies c on c.id = i.copy_id
  where i.trade_id = p_trade;

  if not coalesce(valid, false)
     or (select count(*) from public.trade_items where trade_id = p_trade)
        <> (select count(*) from public.trade_items i join public.card_copies c on c.id = i.copy_id where i.trade_id = p_trade) then
    update public.trades set status = 'expired', resolved_at = now() where id = p_trade;
    return 'expired';
  end if;

  update public.card_copies c
    set owner_id = case i.side when 'give' then t.to_id else t.from_id end,
        obtained_at = now(),
        obtained_via = 'trade'
    from public.trade_items i
    where i.trade_id = p_trade and i.copy_id = c.id;

  select array_agg(copy_id) into moved from public.trade_items where trade_id = p_trade;

  delete from public.garage_slots where copy_id = any (moved);

  update public.trades set status = 'accepted', resolved_at = now() where id = p_trade;
  insert into public.notifications (user_id, kind, actor_id, trade_id)
    values (t.from_id, 'trade_accepted', uid, p_trade);

  -- Other offers built on these copies can no longer happen.
  update public.trades set status = 'expired', resolved_at = now()
    where status = 'pending' and id <> p_trade
      and exists (select 1 from public.trade_items i where i.trade_id = trades.id and i.copy_id = any (moved));

  return 'accepted';
end;
$$;

/* ---------- Market ---------- */

-- Same quote as before, minus reverted sales, with a floor at half of it.
create or replace function public.market_quote(p_slug text)
returns table (
  reference int,
  min_price int,
  max_price int,
  sales int,
  base int,
  tier_price int,
  scarcity real,
  exhaustion real,
  demand real,
  offer real,
  market_median int
)
language sql
stable
security definer
set search_path = ''
as $$
  with k as (
    select c.tier, c.supply, c.minted from public.cards c where c.slug = p_slug
  ),
  med as (
    select percentile_cont(0.5) within group (order by c.supply) as supply
    from public.cards c, k
    where c.tier = k.tier and c.supply is not null
  ),
  f as (
    select public.used_price(k.tier) as tier_price,
           case when k.supply is null or med.supply is null then 1
                else least(4, greatest(0.5, power(med.supply / k.supply, 0.35))) end as scarcity,
           case when k.supply is null then 1
                else 1 + 0.6 * power(least(1, k.minted::float8 / k.supply), 3) end as exhaustion,
           least(1.6, 1 + 0.15 * ln(1 + (select count(*) from public.wishes w where w.card_slug = p_slug))) as demand,
           greatest(0.8, 1 - 0.04 * (
             select count(*) from public.market_listings l where l.card_slug = p_slug and l.expires_at > now()
           )) as offer,
           public.sell_price(k.tier) as floor_price
    from k, med
  ),
  pairs as (
    select distinct on (s.seller_id, s.buyer_id) s.price
    from public.market_sales s
    where s.card_slug = p_slug and s.sold_at > now() - interval '30 days' and s.reverted_at is null
    order by s.seller_id, s.buyer_id, s.sold_at desc
  ),
  m as (
    select count(*)::int as n, percentile_cont(0.5) within group (order by price) as median from pairs
  ),
  q as (
    select f.*,
           greatest(1, round(f.tier_price * f.scarcity * f.exhaustion * f.demand * f.offer))::int as base,
           m.n,
           m.median
    from f, m
  ),
  r as (
    select q.*,
           greatest(q.floor_price, round(
             case when q.n = 0 then q.base
                  else (q.base * 3 + q.median * q.n) / (q.n + 3) end
           ))::int as ref
    from q
  )
  select r.ref, greatest(r.floor_price, round(r.ref * 0.5)::int), greatest(r.floor_price, r.ref * 3),
         r.n, r.base, r.tier_price,
         r.scarcity::real, r.exhaustion::real, r.demand::real, r.offer::real,
         round(r.median)::int
  from r;
$$;

create or replace function public.market_history(p_slug text, p_days int default 90)
returns table (day date, median int, low int, high int, sales int)
language sql
stable
security definer
set search_path = ''
as $$
  select (s.sold_at at time zone 'Europe/Paris')::date,
         round(percentile_cont(0.5) within group (order by s.price))::int,
         min(s.price),
         max(s.price),
         count(*)::int
  from public.market_sales s
  where s.card_slug = p_slug and s.reverted_at is null
    and s.sold_at > now() - make_interval(days => least(greatest(coalesce(p_days, 90), 1), 365))
  group by 1
  order by 1;
$$;

create or replace function public.list_copy(p_copy uuid, p_price int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_slug text;
  q record;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_price is null then
    raise exception 'price out of range';
  end if;
  perform public.assert_trusted(uid);

  select card_slug into v_slug from public.card_copies where id = p_copy and owner_id = uid for update;
  if not found then
    raise exception 'not your card';
  end if;
  if exists (
    select 1 from public.trade_items i join public.trades t on t.id = i.trade_id
    where i.copy_id = p_copy and t.status = 'pending'
  ) then
    raise exception 'in a pending trade';
  end if;
  if (select count(*) from public.market_listings where seller_id = uid) >= 20 then
    raise exception 'too many listings';
  end if;

  select * into q from public.market_quote(v_slug);
  if p_price < q.min_price or p_price > q.max_price then
    raise exception 'price out of range';
  end if;

  delete from public.garage_slots where copy_id = p_copy;
  update public.card_copies set owner_id = null where id = p_copy;
  insert into public.market_listings (copy_id, card_slug, seller_id, price) values (p_copy, v_slug, uid, p_price);
  perform public.notify_wishers(v_slug, 'wish_market', uid);
end;
$$;

create or replace function public.buy_listing(p_copy uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  l public.market_listings;
  fee int;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  perform public.assert_trusted(uid);

  select * into l from public.market_listings where copy_id = p_copy and expires_at > now() for update;
  if not found then
    raise exception 'no longer available';
  end if;
  if l.seller_id = uid then
    raise exception 'your own listing';
  end if;
  if (select count(*) from public.market_sales where buyer_id = uid and sold_at > now() - interval '1 day') >= 10 then
    raise exception 'daily market limit';
  end if;
  if (
    select count(*) from public.market_sales
    where reverted_at is null and sold_at > now() - interval '7 days'
      and ((seller_id = l.seller_id and buyer_id = uid) or (seller_id = uid and buyer_id = l.seller_id))
  ) >= 3 then
    raise exception 'pair limit';
  end if;

  fee := public.market_fee(l.price);
  perform public.move_coins(uid, -l.price, 'market', l.card_slug);
  perform public.move_coins(l.seller_id, l.price - fee, 'market', l.card_slug);

  delete from public.market_listings where copy_id = p_copy;
  update public.card_copies
    set owner_id = uid, obtained_at = now(), obtained_via = 'market'
    where id = p_copy;
  insert into public.market_sales (card_slug, copy_id, seller_id, buyer_id, price, fee)
    values (l.card_slug, p_copy, l.seller_id, uid, l.price, fee);
  insert into public.notifications (user_id, kind, actor_id, card_slug)
    values (l.seller_id, 'market_sold', uid, l.card_slug);
end;
$$;

/* ---------- Leaderboard: no banned player, at most 1000 rows ---------- */

create or replace function public.leaderboard(p_limit int default 50)
returns table (
  rank bigint,
  user_id uuid,
  handle text,
  display_name text,
  avatar_url text,
  score bigint,
  distinct_cards bigint,
  copies bigint,
  series bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with owned as (
    select owner_id, card_slug, count(*) as n
    from public.card_copies
    group by owner_id, card_slug
  ), cards_total as (
    select o.owner_id as uid,
           sum(public.tier_points(c.tier))::bigint as score,
           count(*)::bigint as distinct_cards,
           sum(o.n)::bigint as copies
    from owned o join public.cards c on c.slug = o.card_slug
    group by o.owner_id
  ), series_total as (
    select sc.user_id as uid, sum(s.points)::bigint as score, count(*)::bigint as series
    from public.series_claims sc join public.series s on s.id = sc.series_id
    group by sc.user_id
  ), ranked as (
    select rank() over (
             order by coalesce(c.score, 0) + coalesce(s.score, 0) desc, coalesce(c.distinct_cards, 0) desc
           ) as rank,
           p.id, p.handle, p.display_name, p.avatar_url,
           coalesce(c.score, 0) + coalesce(s.score, 0) as score,
           coalesce(c.distinct_cards, 0) as distinct_cards,
           coalesce(c.copies, 0) as copies,
           coalesce(s.series, 0) as series
    from cards_total c
    full join series_total s on s.uid = c.uid
    join public.profiles p on p.id = coalesce(c.uid, s.uid)
    where p.banned_until is null or p.banned_until <= now()
  )
  select * from ranked
  where rank <= least(greatest(coalesce(p_limit, 50), 1), 1000) or id = (select auth.uid())
  order by rank, display_name;
$$;

/* ---------- Reports ---------- */

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users (id) on delete cascade,
  target_id uuid not null references auth.users (id) on delete cascade,
  reason text not null check (reason in ('multi_comptes', 'triche', 'pseudo', 'avatar', 'harcelement', 'autre')),
  details text check (char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  resolution text,
  check (reporter_id <> target_id)
);

create unique index reports_open_pair_idx on public.reports (reporter_id, target_id) where status = 'open';
create index reports_status_idx on public.reports (status, created_at desc);
create index reports_target_idx on public.reports (target_id);

-- Read and written only through the functions below.
alter table public.reports enable row level security;

-- Up to 5 reports a day, one open report per player reported.
create function public.report_player(p_target uuid, p_reason text, p_details text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_target is null or p_target = uid then
    raise exception 'cannot report yourself';
  end if;
  if not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'unknown player';
  end if;
  if p_reason is null or p_reason not in ('multi_comptes', 'triche', 'pseudo', 'avatar', 'harcelement', 'autre') then
    raise exception 'unknown reason';
  end if;
  if (select count(*) from public.reports where reporter_id = uid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'too many reports';
  end if;
  if exists (select 1 from public.reports where reporter_id = uid and target_id = p_target and status = 'open') then
    raise exception 'already reported';
  end if;
  insert into public.reports (reporter_id, target_id, reason, details)
    values (uid, p_target, p_reason, nullif(left(trim(coalesce(p_details, '')), 500), ''));
end;
$$;

/* ---------- Admins ---------- */

-- Filled by hand, e.g.:
--   insert into public.admins (user_id) select id from public.profiles where handle = '...';
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create table public.moderation_log (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users (id) on delete set null,
  target_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('ban', 'unban', 'coins', 'revert_trade', 'revert_sale', 'report')),
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index moderation_log_target_idx on public.moderation_log (target_id, created_at desc);
alter table public.moderation_log enable row level security;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

create function public.assert_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null or not exists (select 1 from public.admins where user_id = uid) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return uid;
end;
$$;

/* ---------- The signed-in player's standing ---------- */

create function public.my_account()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'banned_until', p.banned_until,
    'ban_reason', p.ban_reason,
    'trade_block', public.trade_block(p.id),
    'trade_from', public.trade_from(p.id),
    'young', p.created_at > now() - interval '30 days',
    'proposed_today', (select count(*) from public.trades where from_id = p.id and created_at > now() - interval '1 day'),
    'traded_today', public.trades_today(p.id),
    'bought_today', (select count(*) from public.market_sales where buyer_id = p.id and sold_at > now() - interval '1 day'),
    'admin', exists (select 1 from public.admins a where a.user_id = p.id)
  )
  from public.profiles p
  where p.id = (select auth.uid());
$$;

create function public.admin_reports(p_status text default 'open')
returns table (
  id uuid,
  created_at timestamptz,
  reason text,
  details text,
  status text,
  resolution text,
  reporter_handle text,
  reporter_name text,
  target_id uuid,
  target_handle text,
  target_name text,
  target_banned boolean,
  target_open_reports int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.assert_admin();
  return query
    select r.id, r.created_at, r.reason, r.details, r.status, r.resolution,
           rp.handle, rp.display_name,
           r.target_id, tp.handle, tp.display_name,
           coalesce(tp.banned_until > now(), false),
           (select count(*)::int from public.reports o where o.target_id = r.target_id and o.status = 'open')
    from public.reports r
    join public.profiles rp on rp.id = r.reporter_id
    join public.profiles tp on tp.id = r.target_id
    where r.status = coalesce(p_status, 'open')
    order by r.created_at desc
    limit 200;
end;
$$;

create function public.admin_resolve_report(p_id uuid, p_status text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin uuid := public.assert_admin();
  target uuid;
begin
  if p_status not in ('resolved', 'dismissed') then
    raise exception 'unknown status';
  end if;
  update public.reports
    set status = p_status, resolved_at = now(), resolved_by = admin, resolution = nullif(trim(coalesce(p_note, '')), '')
    where id = p_id and status = 'open'
    returning target_id into target;
  if not found then
    raise exception 'report not open';
  end if;
  insert into public.moderation_log (admin_id, target_id, action, detail)
    values (admin, target, 'report', jsonb_build_object('report', p_id, 'status', p_status, 'note', p_note));
end;
$$;

-- Everything a moderator needs on one player.
create function public.admin_player(p_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  p public.profiles;
begin
  perform public.assert_admin();
  select * into p from public.profiles where handle = lower(trim(p_handle));
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', p.id,
    'handle', p.handle,
    'name', p.display_name,
    'avatar_url', p.avatar_url,
    'created_at', p.created_at,
    'discord_id', p.discord_id,
    'discord_created_at', public.discord_created_at(p.discord_id),
    'banned_until', p.banned_until,
    'ban_reason', p.ban_reason,
    'trade_block', public.trade_block(p.id),
    'coins', coalesce((select coins from public.pack_wallets where user_id = p.id), 0),
    'bonus', coalesce((select bonus from public.pack_wallets where user_id = p.id), 0),
    'copies', (select count(*) from public.card_copies where owner_id = p.id),
    'packs', (select count(*) from public.pack_openings where user_id = p.id),
    'trades', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select t.id, t.status, t.created_at, t.resolved_at,
               t.from_id = p.id as outgoing,
               o.handle as partner_handle, o.display_name as partner_name,
               coalesce(o.created_at > now() - interval '30 days', false) as partner_young,
               (select coalesce(jsonb_agg(jsonb_build_object('slug', c.card_slug, 'serial', c.serial, 'side', i.side)), '[]')
                  from public.trade_items i join public.card_copies c on c.id = i.copy_id
                  where i.trade_id = t.id) as items
        from public.trades t
        left join public.profiles o on o.id = case when t.from_id = p.id then t.to_id else t.from_id end
        where p.id in (t.from_id, t.to_id)
        order by t.created_at desc
        limit 40
      ) x
    ), '[]'),
    'sales', coalesce((
      select jsonb_agg(x order by x.sold_at desc) from (
        select s.id, s.card_slug, s.price, s.fee, s.sold_at, s.reverted_at,
               s.seller_id = p.id as sold,
               o.handle as partner_handle, o.display_name as partner_name
        from public.market_sales s
        left join public.profiles o on o.id = case when s.seller_id = p.id then s.buyer_id else s.seller_id end
        where p.id in (s.seller_id, s.buyer_id)
        order by s.sold_at desc
        limit 40
      ) x
    ), '[]'),
    'ledger', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select l.amount, l.reason, l.ref, l.created_at
        from public.coin_ledger l
        where l.user_id = p.id
        order by l.created_at desc
        limit 40
      ) x
    ), '[]'),
    'reports', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select r.id, r.reason, r.details, r.status, r.created_at, rp.handle as reporter_handle
        from public.reports r join public.profiles rp on rp.id = r.reporter_id
        where r.target_id = p.id
        order by r.created_at desc
        limit 20
      ) x
    ), '[]'),
    'log', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select m.action, m.detail, m.created_at, ap.handle as admin_handle
        from public.moderation_log m left join public.profiles ap on ap.id = m.admin_id
        where m.target_id = p.id
        order by m.created_at desc
        limit 20
      ) x
    ), '[]')
  );
end;
$$;

-- Pairs of players who deal with each other most over 30 days: the usual
-- trace of a main account and its spares.
create function public.admin_suspects()
returns table (
  a_handle text,
  a_name text,
  a_days int,
  b_handle text,
  b_name text,
  b_days int,
  trades int,
  sales int,
  jetons int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform public.assert_admin();
  return query
    with deals as (
      select least(t.from_id, t.to_id) as a, greatest(t.from_id, t.to_id) as b, 1 as trade, 0 as sale, 0 as price
      from public.trades t
      where t.status = 'accepted' and t.resolved_at > now() - interval '30 days'
      union all
      select least(s.seller_id, s.buyer_id), greatest(s.seller_id, s.buyer_id), 0, 1, s.price
      from public.market_sales s
      where s.reverted_at is null and s.sold_at > now() - interval '30 days'
        and s.seller_id is not null and s.buyer_id is not null
    ), pairs as (
      select d.a, d.b, sum(d.trade)::int as trades, sum(d.sale)::int as sales, sum(d.price)::int as jetons
      from deals d
      group by d.a, d.b
      having count(*) >= 2
    )
    select pa.handle, pa.display_name, extract(day from now() - pa.created_at)::int,
           pb.handle, pb.display_name, extract(day from now() - pb.created_at)::int,
           pairs.trades, pairs.sales, pairs.jetons
    from pairs
    join public.profiles pa on pa.id = pairs.a
    join public.profiles pb on pb.id = pairs.b
    order by pairs.trades + pairs.sales desc, least(pa.created_at, pb.created_at) desc
    limit 50;
end;
$$;

-- p_days null: for good. Signs the player out everywhere, cancels their
-- pending trades and takes their cars off the market.
create function public.admin_ban(p_user uuid, p_days int, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin uuid := public.assert_admin();
  until_at timestamptz;
begin
  if p_user = admin then
    raise exception 'cannot ban yourself';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'unknown player';
  end if;
  until_at := case when p_days is null then now() + interval '100 years'
                   else now() + make_interval(days => greatest(p_days, 1)) end;

  update public.profiles set banned_until = until_at, ban_reason = nullif(trim(coalesce(p_reason, '')), '')
    where id = p_user;
  -- Supabase Auth refuses to sign in or refresh a banned user.
  update auth.users set banned_until = until_at where id = p_user;
  delete from auth.sessions where user_id = p_user;

  update public.trades set status = 'cancelled', resolved_at = now()
    where status = 'pending' and p_user in (from_id, to_id);
  update public.card_copies c set owner_id = l.seller_id
    from public.market_listings l
    where l.copy_id = c.id and l.seller_id = p_user;
  delete from public.market_listings where seller_id = p_user;

  insert into public.moderation_log (admin_id, target_id, action, detail)
    values (admin, p_user, 'ban', jsonb_build_object('days', p_days, 'until', until_at, 'reason', p_reason));
end;
$$;

create function public.admin_unban(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin uuid := public.assert_admin();
begin
  update public.profiles set banned_until = null, ban_reason = null where id = p_user;
  if not found then
    raise exception 'unknown player';
  end if;
  update auth.users set banned_until = null where id = p_user;
  insert into public.moderation_log (admin_id, target_id, action) values (admin, p_user, 'unban');
end;
$$;

create function public.admin_adjust_coins(p_user uuid, p_amount int, p_note text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin uuid := public.assert_admin();
  balance int;
begin
  if p_amount is null or p_amount = 0 or abs(p_amount) > 100000 then
    raise exception 'amount out of range';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'unknown player';
  end if;
  balance := public.move_coins(p_user, p_amount, 'admin', left(p_note, 120));
  insert into public.notifications (user_id, kind) values (p_user, 'moderation');
  insert into public.moderation_log (admin_id, target_id, action, detail)
    values (admin, p_user, 'coins', jsonb_build_object('amount', p_amount, 'balance', balance, 'note', p_note));
  return balance;
end;
$$;

-- Puts every card of an accepted trade back, as long as none moved since.
create function public.admin_revert_trade(p_trade uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin uuid := public.assert_admin();
  t public.trades;
  moved uuid[];
begin
  select * into t from public.trades where id = p_trade for update;
  if not found or t.status <> 'accepted' then
    raise exception 'trade not accepted';
  end if;

  perform 1 from public.card_copies c
    join public.trade_items i on i.copy_id = c.id
    where i.trade_id = p_trade
    for update of c;
  if exists (
    select 1 from public.trade_items i
    left join public.card_copies c on c.id = i.copy_id
    where i.trade_id = p_trade
      and c.owner_id is distinct from case i.side when 'give' then t.to_id else t.from_id end
  ) then
    raise exception 'cards moved on';
  end if;

  select array_agg(copy_id) into moved from public.trade_items where trade_id = p_trade;
  update public.card_copies c
    set owner_id = case i.side when 'give' then t.from_id else t.to_id end,
        obtained_at = now()
    from public.trade_items i
    where i.trade_id = p_trade and i.copy_id = c.id;
  delete from public.garage_slots where copy_id = any (moved);
  update public.trades set status = 'expired', resolved_at = now()
    where status = 'pending'
      and exists (select 1 from public.trade_items i where i.trade_id = trades.id and i.copy_id = any (moved));
  update public.trades set status = 'reverted', resolved_at = now() where id = p_trade;

  insert into public.notifications (user_id, kind, trade_id)
    values (t.from_id, 'moderation', p_trade), (t.to_id, 'moderation', p_trade);
  insert into public.moderation_log (admin_id, target_id, action, detail)
    values (admin, t.from_id, 'revert_trade', jsonb_build_object('trade', p_trade, 'partner', t.to_id, 'note', p_note)),
           (admin, t.to_id, 'revert_trade', jsonb_build_object('trade', p_trade, 'partner', t.from_id, 'note', p_note));
end;
$$;

-- The car goes back to the seller, the buyer gets the price back, and the
-- seller gives back what they received, as far as their balance allows.
create function public.admin_revert_sale(p_sale bigint, p_note text)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin uuid := public.assert_admin();
  s public.market_sales;
  owed int;
  taken int;
begin
  select * into s from public.market_sales where id = p_sale for update;
  if not found or s.reverted_at is not null then
    raise exception 'sale not found';
  end if;
  if s.copy_id is null or s.seller_id is null or s.buyer_id is null then
    raise exception 'cards moved on';
  end if;
  perform 1 from public.card_copies where id = s.copy_id and owner_id = s.buyer_id for update;
  if not found then
    raise exception 'cards moved on';
  end if;

  update public.card_copies set owner_id = s.seller_id, obtained_at = now() where id = s.copy_id;
  delete from public.garage_slots where copy_id = s.copy_id;
  update public.trades set status = 'expired', resolved_at = now()
    where status = 'pending'
      and exists (select 1 from public.trade_items i where i.trade_id = trades.id and i.copy_id = s.copy_id);

  perform public.move_coins(s.buyer_id, s.price, 'admin', 'sale:' || s.id);
  owed := s.price - s.fee;
  insert into public.pack_wallets (user_id) values (s.seller_id) on conflict do nothing;
  select least(coins, owed) into taken from public.pack_wallets where user_id = s.seller_id for update;
  if taken > 0 then
    perform public.move_coins(s.seller_id, -taken, 'admin', 'sale:' || s.id);
  end if;
  update public.market_sales set reverted_at = now() where id = p_sale;

  insert into public.notifications (user_id, kind, card_slug)
    values (s.seller_id, 'moderation', s.card_slug), (s.buyer_id, 'moderation', s.card_slug);
  insert into public.moderation_log (admin_id, target_id, action, detail)
    values (admin, s.seller_id, 'revert_sale', jsonb_build_object('sale', p_sale, 'owed', owed, 'taken', taken, 'note', p_note)),
           (admin, s.buyer_id, 'revert_sale', jsonb_build_object('sale', p_sale, 'refund', s.price, 'note', p_note));
  return taken;
end;
$$;

/* ---------- Grants ---------- */

revoke execute on function public.trade_block(uuid) from public, anon, authenticated;
revoke execute on function public.trade_from(uuid) from public, anon, authenticated;
revoke execute on function public.assert_trusted(uuid) from public, anon, authenticated;
revoke execute on function public.trades_today(uuid) from public, anon, authenticated;
revoke execute on function public.copies_value(uuid[]) from public, anon, authenticated;
revoke execute on function public.assert_admin() from public, anon, authenticated;
revoke execute on function public.discord_created_at(text) from public, anon, authenticated;

revoke execute on function public.my_account() from public, anon;
revoke execute on function public.report_player(uuid, text, text) from public, anon;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.admin_reports(text) from public, anon;
revoke execute on function public.admin_resolve_report(uuid, text, text) from public, anon;
revoke execute on function public.admin_player(text) from public, anon;
revoke execute on function public.admin_suspects() from public, anon;
revoke execute on function public.admin_ban(uuid, int, text) from public, anon;
revoke execute on function public.admin_unban(uuid) from public, anon;
revoke execute on function public.admin_adjust_coins(uuid, int, text) from public, anon;
revoke execute on function public.admin_revert_trade(uuid, text) from public, anon;
revoke execute on function public.admin_revert_sale(bigint, text) from public, anon;

-- Admin functions check public.admins themselves.
grant execute on function public.my_account() to authenticated;
grant execute on function public.report_player(uuid, text, text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_reports(text) to authenticated;
grant execute on function public.admin_resolve_report(uuid, text, text) to authenticated;
grant execute on function public.admin_player(text) to authenticated;
grant execute on function public.admin_suspects() to authenticated;
grant execute on function public.admin_ban(uuid, int, text) to authenticated;
grant execute on function public.admin_unban(uuid) to authenticated;
grant execute on function public.admin_adjust_coins(uuid, int, text) to authenticated;
grant execute on function public.admin_revert_trade(uuid, text) to authenticated;
grant execute on function public.admin_revert_sale(bigint, text) to authenticated;
