-- Driving permit: player levels earned by playing, with rewards.
--
-- Experience is read from what the player already did (packs opened, days
-- of daily bonus, missions, trades, series, salon challenges, achievement
-- steps), so it covers past play and needs no ledger. The level reached is
-- kept on the profile and never goes down, even if a trade partner deletes
-- their account: garage places and shop discounts are never taken back.
--
-- Every number here must match lib/permit.ts.

/* ---------- Experience and levels ---------- */

create function public.permit_xp(p_user uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select (
      10 * (select count(*) from public.pack_openings where user_id = p_user)
    + 25 * coalesce((select days from public.pack_wallets where user_id = p_user), 0)
    + 15 * (select count(*) from public.mission_claims where user_id = p_user)
    -- One trade per partner per day counts, so two accounts cannot farm it.
    + 20 * (
        select count(distinct (case when from_id = p_user then to_id else from_id end, (resolved_at at time zone 'Europe/Paris')::date))
        from public.trades
        where status = 'accepted' and p_user in (from_id, to_id)
      )
    + 150 * (select count(*) from public.series_claims where user_id = p_user)
    + 60 * (select count(*) from public.salon_claims where user_id = p_user)
    + 40 * (select count(*) from public.achievement_claims where user_id = p_user)
  )::int;
$$;

-- Experience needed to reach a level: 100 for level 2, then 50 more per step.
create function public.permit_threshold(p_level int)
returns int
language sql
immutable
set search_path = ''
as $$
  select 100 * (p_level - 1) + 25 * (p_level - 1) * (p_level - 2);
$$;

create function public.permit_level_for(p_xp int)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select max(l)::smallint from generate_series(1, 30) l where public.permit_threshold(l) <= p_xp;
$$;

/* ---------- Rewards ---------- */

-- 6 places, one more at levels 5, 10, 20 and 30.
create function public.permit_garage_slots(p_level int)
returns int
language sql
immutable
set search_path = ''
as $$
  select 6 + (p_level >= 5)::int + (p_level >= 10)::int + (p_level >= 20)::int + (p_level >= 30)::int;
$$;

-- Percent off cards bought at the shop (window and second-hand).
create function public.permit_discount(p_level int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case when p_level >= 30 then 15 when p_level >= 20 then 10 when p_level >= 10 then 5 else 0 end;
$$;

create function public.discounted(p_price int, p_level int)
returns int
language sql
immutable
set search_path = ''
as $$
  select ceil(p_price * (100 - public.permit_discount(p_level)) / 100.0)::int;
$$;

/* ---------- Level kept on the profile ---------- */

alter table public.profiles add column permit_level smallint not null default 1
  check (permit_level between 1 and 30);
-- Profiles are read column by column: the level is public, like the rest of the profile.
grant select (permit_level) on public.profiles to anon, authenticated;

alter table public.notifications add column level smallint;
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in (
    'trade_received', 'trade_accepted', 'trade_declined', 'trade_cancelled',
    'wish_shop', 'wish_used', 'wish_double', 'wish_market',
    'market_sold', 'market_expired', 'moderation', 'permit_up'
  ));

-- Raises the stored level to what the experience allows, and tells the
-- player once per level gained. Returns the level.
create function public.sync_permit(p_user uuid)
returns smallint
language plpgsql
security definer
set search_path = ''
as $$
declare
  before smallint;
  after smallint;
begin
  select permit_level into before from public.profiles where id = p_user for update;
  if not found then
    return null;
  end if;
  after := greatest(before, public.permit_level_for(public.permit_xp(p_user)));
  if after > before then
    update public.profiles set permit_level = after where id = p_user;
    insert into public.notifications (user_id, kind, level)
      select p_user, 'permit_up', l from generate_series(before + 1, after) l;
  end if;
  return after;
end;
$$;

-- Kept current by the tables that give experience.
create function public.on_permit_rows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_permit(u) from (select distinct user_id as u from new_rows) s;
  return null;
end;
$$;

create trigger pack_openings_permit after insert on public.pack_openings
  referencing new table as new_rows for each statement execute function public.on_permit_rows();
create trigger mission_claims_permit after insert on public.mission_claims
  referencing new table as new_rows for each statement execute function public.on_permit_rows();
create trigger series_claims_permit after insert on public.series_claims
  referencing new table as new_rows for each statement execute function public.on_permit_rows();
create trigger salon_claims_permit after insert on public.salon_claims
  referencing new table as new_rows for each statement execute function public.on_permit_rows();
create trigger achievement_claims_permit after insert on public.achievement_claims
  referencing new table as new_rows for each statement execute function public.on_permit_rows();

create function public.on_permit_days()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.days > old.days then
    perform public.sync_permit(new.user_id);
  end if;
  return null;
end;
$$;

create trigger pack_wallets_permit after update of days on public.pack_wallets
  for each row execute function public.on_permit_days();

create function public.on_permit_trade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status <> 'accepted' then
    perform public.sync_permit(new.from_id);
    perform public.sync_permit(new.to_id);
  end if;
  return null;
end;
$$;

create trigger trades_permit after update of status on public.trades
  for each row execute function public.on_permit_trade();

/* ---------- What the player sees ---------- */

create function public.my_permit()
returns jsonb
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
  return jsonb_build_object(
    'level', public.sync_permit(uid),
    'xp', public.permit_xp(uid)
  );
end;
$$;

-- Metrics gain the level, so cosmetics can be unlocked by it.
create or replace function public.player_metrics(p_user uuid)
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
    'bought', (select count(*) from public.shop_purchases where user_id = p_user),
    'level', coalesce((select permit_level from public.profiles where id = p_user), 1)
  );
$$;

/* ---------- Reward: garage places ---------- */

alter table public.garage_slots drop constraint garage_slots_position_check;
alter table public.garage_slots add constraint garage_slots_position_check check (position between 0 and 9);

create or replace function public.set_garage(p_copies uuid[])
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
  if coalesce(array_length(p_copies, 1), 0) > public.permit_garage_slots(public.sync_permit(uid)) then
    raise exception 'garage is full';
  end if;
  if exists (
    select 1 from unnest(p_copies) c
    where not exists (select 1 from public.card_copies where id = c and owner_id = uid)
  ) then
    raise exception 'not your card';
  end if;

  delete from public.garage_slots where user_id = uid;
  insert into public.garage_slots (user_id, position, copy_id)
  select uid, (ord - 1)::smallint, c
  from unnest(p_copies) with ordinality as t(c, ord);
end;
$$;

/* ---------- Reward: shop discount ---------- */

create or replace function public.shop_window()
returns table (period text, slot smallint, card_slug text, price int, bought boolean, sold_out boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  lvl int := coalesce((select permit_level from public.profiles where id = (select auth.uid())), 1);
  p record;
begin
  select * into p from public.shop_periods();
  perform public.ensure_shop_offers();
  return query
    select o.period, o.slot, o.card_slug, public.discounted(public.shop_price(c.tier), lvl),
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

create or replace function public.buy_offer(p_period text, p_slot int)
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

  cost := public.discounted(public.shop_price(k.tier), public.sync_permit(uid));
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

create or replace function public.buy_used(p_copy uuid)
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

  cost := public.discounted(public.used_price(v_tier), public.sync_permit(uid));
  perform public.move_coins(uid, -cost, 'shop', v_slug);

  delete from public.shop_stock where copy_id = p_copy;
  update public.card_copies
    set owner_id = uid, obtained_at = now(), obtained_via = 'shop'
    where id = p_copy;
  insert into public.shop_purchases (user_id, copy_id, card_slug, source, price)
    values (uid, p_copy, v_slug, 'occasion', cost);
end;
$$;

/* ---------- Reward: cosmetics ---------- */

insert into public.cosmetics (id, kind, price, metric, goal) values
  ('title-permis-b', 'title', null, 'level', 5),
  ('frame-licence', 'frame', null, 'level', 10),
  ('badge-rallye', 'badge', null, 'level', 15),
  ('banner-speciale', 'banner', null, 'level', 15),
  ('title-pilote-essai', 'title', null, 'level', 20),
  ('frame-officiel', 'frame', null, 'level', 25),
  ('title-legende-paddock', 'title', null, 'level', 30),
  ('banner-legende', 'banner', null, 'level', 30);

/* ---------- Grants ---------- */

revoke execute on function public.permit_xp(uuid) from public, anon, authenticated;
revoke execute on function public.sync_permit(uuid) from public, anon, authenticated;
revoke execute on function public.on_permit_rows() from public, anon, authenticated;
revoke execute on function public.on_permit_days() from public, anon, authenticated;
revoke execute on function public.on_permit_trade() from public, anon, authenticated;

revoke execute on function public.my_permit() from public, anon;
grant execute on function public.my_permit() to authenticated;

-- Price formulas: nothing private.
grant execute on function public.permit_threshold(int) to anon, authenticated;
grant execute on function public.permit_level_for(int) to anon, authenticated;
grant execute on function public.permit_garage_slots(int) to anon, authenticated;
grant execute on function public.permit_discount(int) to anon, authenticated;
grant execute on function public.discounted(int, int) to anon, authenticated;

/* ---------- Players who already played ---------- */

-- Their level now, without a notification per level for past play.
update public.profiles set permit_level = public.permit_level_for(public.permit_xp(id));

insert into public.player_cosmetics (user_id, cosmetic_id, via)
select p.id, c.id, 'unlock'
from public.profiles p
join public.cosmetics c on c.metric = 'level' and p.permit_level >= c.goal
on conflict do nothing;
