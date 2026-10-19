-- Launch: the market opens early.
--
-- New players wait 3 days (and a 30-day-old Discord account) before
-- trading or using the market. During the first days of the game, everyone
-- is new: the market opens as soon as a player has opened 10 boosters, so
-- they can complete their collection right away. Trades keep their rules,
-- and so do every market limit (10 purchases a day, 3 sales a week between
-- the same two players, listings from half the quote). Banned players stay
-- out.
--
-- Every number here must match lib/trust.ts.

-- End of the launch window.
create function public.launch_market_until()
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select timestamptz '2026-10-30 00:00:00 Europe/Paris';
$$;

-- Why a player can't use the market yet; null when they can. p_at is for tests.
create function public.market_block(p_user uuid, p_at timestamptz default now())
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when b.reason is null or b.reason = 'account banned' or b.reason = 'not authenticated' then b.reason
    when p_at >= public.launch_market_until() then b.reason
    when (select count(*) from public.pack_openings where user_id = p_user) >= 10 then null
    else 'launch packs'
  end
  from (select public.trade_block(p_user) as reason) b;
$$;

create function public.assert_market(p_user uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  reason text := public.market_block(p_user);
begin
  if reason is not null then
    raise exception '%', reason using errcode = 'P0001';
  end if;
end;
$$;

/* ---------- The market checks its own gate ---------- */

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
  perform public.assert_market(uid);

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
  perform public.assert_market(uid);

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

/* ---------- The player's standing gains the market gate ---------- */

create or replace function public.my_account()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'onboarded', p.onboarded_at is not null,
    'banned_until', p.banned_until,
    'ban_reason', p.ban_reason,
    'trade_block', public.trade_block(p.id),
    'trade_from', public.trade_from(p.id),
    'market_block', public.market_block(p.id),
    'launch_until', case when now() < public.launch_market_until() then public.launch_market_until() end,
    'packs_opened', (select count(*) from public.pack_openings where user_id = p.id),
    'young', p.created_at > now() - interval '30 days',
    'proposed_today', (select count(*) from public.trades where from_id = p.id and created_at > now() - interval '1 day'),
    'traded_today', public.trades_today(p.id),
    'bought_today', (select count(*) from public.market_sales where buyer_id = p.id and sold_at > now() - interval '1 day'),
    'admin', exists (select 1 from public.admins a where a.user_id = p.id)
  )
  from public.profiles p
  where p.id = (select auth.uid());
$$;

revoke execute on function public.market_block(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.assert_market(uuid) from public, anon, authenticated;
grant execute on function public.launch_market_until() to anon, authenticated;
