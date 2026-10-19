-- Player market: any car can be listed at the price its owner picks, within
-- a band around its quote (cote). Sales are kept to chart each car's quote.
-- Anti-inflation: a 10 % fee burned on every sale, a ceiling at 3x the quote,
-- and a quote that one pair of accounts trading together can't move.
-- Every number here must match lib/market.ts.

alter table public.coin_ledger drop constraint coin_ledger_reason_check;
alter table public.coin_ledger add constraint coin_ledger_reason_check
  check (reason in ('daily', 'achievement', 'sell', 'pack', 'shop', 'mission', 'market'));

alter table public.card_copies drop constraint card_copies_obtained_via_check;
alter table public.card_copies add constraint card_copies_obtained_via_check
  check (obtained_via in ('pack', 'trade', 'shop', 'market'));

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in (
    'trade_received', 'trade_accepted', 'trade_declined', 'trade_cancelled',
    'wish_shop', 'wish_used', 'wish_double', 'wish_market',
    'market_sold', 'market_expired'
  ));

/* ---------- Listings and sales ---------- */

-- A listed copy belongs to nobody (owner_id null) until it sells or comes
-- back: no trade, garage or second sale can touch it meanwhile.
create table public.market_listings (
  copy_id uuid primary key references public.card_copies (id) on delete cascade,
  card_slug text not null references public.cards (slug) on delete cascade,
  seller_id uuid not null references auth.users (id) on delete cascade,
  price int not null check (price > 0),
  listed_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

create index market_listings_card_idx on public.market_listings (card_slug, price);
create index market_listings_seller_idx on public.market_listings (seller_id);
create index market_listings_listed_idx on public.market_listings (listed_at desc);

create table public.market_sales (
  id bigint generated always as identity primary key,
  card_slug text not null references public.cards (slug) on delete cascade,
  copy_id uuid references public.card_copies (id) on delete set null,
  seller_id uuid references auth.users (id) on delete set null,
  buyer_id uuid references auth.users (id) on delete set null,
  price int not null check (price > 0),
  fee int not null check (fee >= 0),
  sold_at timestamptz not null default now()
);

create index market_sales_card_idx on public.market_sales (card_slug, sold_at desc);

alter table public.market_listings enable row level security;
alter table public.market_sales enable row level security;
create policy "Listings are public" on public.market_listings for select to anon, authenticated using (true);
create policy "Sales are public" on public.market_sales for select to anon, authenticated using (true);

/* ---------- Quote and price band ---------- */

-- 10 % of the price, at least 1 jeton: burned, it leaves the economy.
create function public.market_fee(p_price int)
returns int language sql immutable set search_path = ''
as $$ select greatest(1, ceil(p_price * 0.10))::int; $$;

-- The quote is the median price of the last 30 days, counting one sale per
-- seller-buyer pair (their latest), once 3 pairs have traded the car. Before
-- that, the second-hand shop price stands in. Listings go from the shop's
-- buy-back price to 3x the quote.
create function public.market_quote(p_slug text)
returns table (reference int, min_price int, max_price int, sales int)
language sql
stable
security definer
set search_path = ''
as $$
  with k as (
    select tier from public.cards where slug = p_slug
  ),
  pairs as (
    select distinct on (s.seller_id, s.buyer_id) s.price
    from public.market_sales s
    where s.card_slug = p_slug and s.sold_at > now() - interval '30 days'
    order by s.seller_id, s.buyer_id, s.sold_at desc
  ),
  m as (
    select count(*)::int as n, percentile_cont(0.5) within group (order by price) as med from pairs
  ),
  r as (
    select case when m.n >= 3 then greatest(1, round(m.med))::int else public.used_price(k.tier) end as ref,
           public.sell_price(k.tier) as floor_price,
           m.n
    from k, m
  )
  select r.ref, r.floor_price, greatest(r.floor_price, r.ref * 3), r.n from r;
$$;

-- Daily median, low, high and count of sales, for the chart.
create function public.market_history(p_slug text, p_days int default 90)
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
  where s.card_slug = p_slug and s.sold_at > now() - make_interval(days => least(greatest(p_days, 1), 365))
  group by 1
  order by 1;
$$;

/* ---------- List, buy, take back, expire ---------- */

create function public.expire_listings()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  l record;
begin
  for l in
    delete from public.market_listings where expires_at <= now() returning copy_id, card_slug, seller_id
  loop
    update public.card_copies set owner_id = l.seller_id where id = l.copy_id;
    insert into public.notifications (user_id, kind, card_slug) values (l.seller_id, 'market_expired', l.card_slug);
  end loop;
end;
$$;

-- Up to 20 cars on sale at once, for a week. Any copy can go, the last one
-- too, unless it waits in a pending trade.
create function public.list_copy(p_copy uuid, p_price int)
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

create function public.cancel_listing(p_copy uuid)
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
  delete from public.market_listings where copy_id = p_copy and seller_id = uid;
  if not found then
    raise exception 'no longer available';
  end if;
  update public.card_copies set owner_id = uid where id = p_copy;
end;
$$;

-- The buyer pays the price; the seller gets it minus the fee.
create function public.buy_listing(p_copy uuid)
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

  select * into l from public.market_listings where copy_id = p_copy and expires_at > now() for update;
  if not found then
    raise exception 'no longer available';
  end if;
  if l.seller_id = uid then
    raise exception 'your own listing';
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

/* ---------- Wallet: expired listings come back on the next reading ---------- */

create or replace function public.my_pack_wallet()
returns table (
  available int,
  next_at timestamptz,
  bonus int,
  coins int,
  daily_ready boolean,
  streak int,
  claimable int,
  missions int
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

  -- Draws the day's shop window as soon as anyone plays, so wishlist alerts
  -- don't wait for a visit to the shop.
  perform public.ensure_shop_offers();
  -- Unsold listings past their week go back to their sellers.
  perform public.expire_listings();

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
    (select count(*)::int from public.claimable_achievements(uid)),
    (select count(*)::int from public.mission_board(uid) b where b.progress >= b.goal and not b.claimed);
end;
$$;

/* ---------- Grants ---------- */

revoke execute on function public.expire_listings() from public, anon, authenticated;

revoke execute on function public.list_copy(uuid, int) from public, anon;
revoke execute on function public.cancel_listing(uuid) from public, anon;
revoke execute on function public.buy_listing(uuid) from public, anon;

grant execute on function public.list_copy(uuid, int) to authenticated;
grant execute on function public.cancel_listing(uuid) to authenticated;
grant execute on function public.buy_listing(uuid) to authenticated;
grant execute on function public.market_fee(int) to anon, authenticated;
grant execute on function public.market_quote(text) to anon, authenticated;
grant execute on function public.market_history(text, int) to anon, authenticated;
