-- Game core: real car catalogue with numbered copies capped at real-world
-- production, public profiles, garage, trades, notifications, leaderboard.

/* ---------- Profiles: public, with a URL handle ---------- */

create extension if not exists unaccent with schema extensions;

alter table public.profiles add column handle text;

create function public.slugify_handle(name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(trim(both '-' from regexp_replace(lower(extensions.unaccent(coalesce(name, ''))), '[^a-z0-9]+', '-', 'g')), ''),
    'collectionneur'
  );
$$;

create function public.unique_handle(name text, uid uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  base text := left(public.slugify_handle(name), 24);
  candidate text := base;
  n int := 1;
begin
  while exists (select 1 from public.profiles where handle = candidate and id <> uid) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  return candidate;
end;
$$;

update public.profiles set handle = public.unique_handle(display_name, id);
alter table public.profiles alter column handle set not null;
alter table public.profiles add constraint profiles_handle_key unique (handle);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := new.raw_user_meta_data;
  name text := coalesce(meta -> 'custom_claims' ->> 'global_name', meta ->> 'full_name', meta ->> 'name');
begin
  insert into public.profiles (id, discord_id, display_name, avatar_url, handle)
  values (new.id, meta ->> 'provider_id', name, meta ->> 'avatar_url', public.unique_handle(name, new.id));

  if new.email is not null then
    insert into public.waitlist_signups (email, source, user_id)
    values (lower(new.email), 'discord_signup', new.id)
    on conflict (email) do update
      set user_id = excluded.user_id
      where public.waitlist_signups.user_id is null;
  end if;

  return new;
end;
$$;

-- Profiles are public, minus the Discord id.
drop policy "Users read their own profile" on public.profiles;
create policy "Profiles are public" on public.profiles for select to anon, authenticated using (true);
revoke select on public.profiles from anon, authenticated;
grant select (id, handle, display_name, avatar_url, created_at) on public.profiles to anon, authenticated;

/* ---------- Catalogue ---------- */

-- The six invented cards and the test openings that drew them go away.
delete from public.pack_openings;
delete from public.cards;

alter table public.cards
  add column traits text[] not null default '{}',
  add column supply int check (supply is null or supply > 0),
  add column minted int not null default 0;

alter table public.cards add constraint cards_minted_within_supply
  check (supply is null or minted <= supply);

create index cards_tier_idx on public.cards (tier);

drop policy "Signed-in players read cards" on public.cards;
create policy "Cards are public" on public.cards for select to anon, authenticated using (true);

alter table public.packs rename column themed_cultures to themes;

update public.packs set themes = '{JDM,Kei}' where id = 'nuit-jdm';
update public.packs set themes = '{gt,supercar,hypercar}' where id = 'grand-tourisme';
update public.packs set themes = '{classique,youngtimer}' where id = 'garage-classique';

/* ---------- Numbered copies ---------- */

create table public.card_copies (
  id uuid primary key default gen_random_uuid(),
  card_slug text not null references public.cards (slug) on delete cascade,
  serial int not null,
  owner_id uuid not null references auth.users (id) on delete cascade,
  obtained_at timestamptz not null default now(),
  obtained_via text not null check (obtained_via in ('pack', 'trade')),
  unique (card_slug, serial)
);

create index card_copies_owner_idx on public.card_copies (owner_id, obtained_at desc);
create index card_copies_card_idx on public.card_copies (card_slug);

alter table public.card_copies enable row level security;
create policy "Copies are public" on public.card_copies for select to anon, authenticated using (true);

alter table public.pack_openings drop column cards;
alter table public.pack_openings add column copies uuid[] not null default '{}';

/* ---------- Garage ---------- */

create table public.garage_slots (
  user_id uuid not null references auth.users (id) on delete cascade,
  position smallint not null check (position between 0 and 5),
  copy_id uuid not null unique references public.card_copies (id) on delete cascade,
  primary key (user_id, position)
);

alter table public.garage_slots enable row level security;
create policy "Garages are public" on public.garage_slots for select to anon, authenticated using (true);

create function public.set_garage(p_copies uuid[])
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
  if coalesce(array_length(p_copies, 1), 0) > 6 then
    raise exception 'garage holds 6 cards';
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

/* ---------- Notifications ---------- */

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('trade_received', 'trade_accepted', 'trade_declined', 'trade_cancelled')),
  actor_id uuid references auth.users (id) on delete cascade,
  trade_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
create policy "Players read their notifications" on public.notifications
  for select to authenticated using ((select auth.uid()) = user_id);

create function public.mark_notifications_read()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications set read_at = now()
  where user_id = (select auth.uid()) and read_at is null;
$$;

/* ---------- Trades ---------- */

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references auth.users (id) on delete cascade,
  to_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (from_id <> to_id)
);

create index trades_from_idx on public.trades (from_id, created_at desc);
create index trades_to_idx on public.trades (to_id, created_at desc);

-- side 'give': a copy of from_id; side 'take': a copy of to_id.
create table public.trade_items (
  trade_id uuid not null references public.trades (id) on delete cascade,
  copy_id uuid not null references public.card_copies (id) on delete cascade,
  side text not null check (side in ('give', 'take')),
  primary key (trade_id, copy_id)
);

create index trade_items_copy_idx on public.trade_items (copy_id);

alter table public.notifications
  add constraint notifications_trade_fk foreign key (trade_id) references public.trades (id) on delete cascade;

alter table public.trades enable row level security;
alter table public.trade_items enable row level security;

create policy "Players read their trades" on public.trades
  for select to authenticated
  using ((select auth.uid()) in (from_id, to_id));

create policy "Players read their trade items" on public.trade_items
  for select to authenticated
  using (exists (
    select 1 from public.trades t
    where t.id = trade_id and (select auth.uid()) in (t.from_id, t.to_id)
  ));

create function public.create_trade(p_to uuid, p_give uuid[], p_take uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  tid uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_to = uid then
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
  if (select count(*) from public.trades where from_id = uid and status = 'pending') >= 20 then
    raise exception 'too many pending trades';
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

create function public.respond_trade(p_trade uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  t public.trades;
  valid boolean;
  moved uuid[];
begin
  select * into t from public.trades where id = p_trade for update;
  if not found or t.status <> 'pending' then
    raise exception 'trade is not pending';
  end if;

  if uid = t.from_id and not p_accept then
    update public.trades set status = 'cancelled', resolved_at = now() where id = p_trade;
    insert into public.notifications (user_id, kind, actor_id, trade_id)
      values (t.to_id, 'trade_cancelled', uid, p_trade);
    return 'cancelled';
  end if;

  if uid is distinct from t.to_id then
    raise exception 'not your trade';
  end if;

  if not p_accept then
    update public.trades set status = 'declined', resolved_at = now() where id = p_trade;
    insert into public.notifications (user_id, kind, actor_id, trade_id)
      values (t.from_id, 'trade_declined', uid, p_trade);
    return 'declined';
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

/* ---------- Packs: draw numbered copies within supply ---------- */

drop function public.open_pack(text);

create function public.open_pack(p_pack text)
returns table (copy_id uuid, card_slug text, serial int)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  pack_themes text[];
  w public.pack_wallets;
  gained int;
  avail int;
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

  select themes into pack_themes from public.packs where id = p_pack;
  if not found then
    raise exception 'unknown pack';
  end if;

  insert into public.pack_wallets (user_id) values (uid) on conflict do nothing;
  select * into w from public.pack_wallets where user_id = uid for update;

  gained := floor(extract(epoch from (now() - w.anchor_at)) / 600)::int;
  avail := least(10, w.stored + gained);

  if avail < 1 then
    raise exception 'no packs available' using errcode = 'P0001';
  end if;

  if w.stored + gained >= 10 then
    update public.pack_wallets set stored = 9, anchor_at = now() where user_id = uid;
  else
    update public.pack_wallets
      set stored = avail - 1,
          anchor_at = w.anchor_at + make_interval(secs => gained * 600)
      where user_id = uid;
  end if;

  for i in 1..5 loop
    roll := random();
    if i < 5 then
      slot_tier := case
        when roll < 0.60 then 'common'
        when roll < 0.88 then 'rare'
        when roll < 0.97 then 'epic'
        else 'legendary'
      end;
    else
      slot_tier := case
        when roll < 0.75 then 'rare'
        when roll < 0.94 then 'epic'
        else 'legendary'
      end;
    end if;

    pick := null;
    -- A sold-out tier falls back to the next tier down.
    for t in reverse array_position(tiers, slot_tier)..1 loop
      select c.slug into pick
      from public.cards c
      where c.tier = tiers[t] and (c.supply is null or c.minted < c.supply)
      order by -ln(greatest(random(), 1e-12))
               / (case when c.traits && pack_themes then 4 else 1 end)
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

  insert into public.pack_openings (user_id, pack_id, copies) values (uid, p_pack, pulled);
end;
$$;

/* ---------- Leaderboard ---------- */

-- Score: each distinct card counts once, weighted by rarity, so duplicates
-- are worth trading rather than hoarding.
create function public.tier_points(tier text)
returns int
language sql
immutable
set search_path = ''
as $$
  select case tier when 'common' then 10 when 'rare' then 30 when 'epic' then 100 else 400 end;
$$;

create function public.leaderboard(p_limit int default 50)
returns table (
  rank bigint,
  user_id uuid,
  handle text,
  display_name text,
  avatar_url text,
  score bigint,
  distinct_cards bigint,
  copies bigint
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
  ), totals as (
    select o.owner_id,
           sum(public.tier_points(c.tier))::bigint as score,
           count(*)::bigint as distinct_cards,
           sum(o.n)::bigint as copies
    from owned o join public.cards c on c.slug = o.card_slug
    group by o.owner_id
  ), ranked as (
    select rank() over (order by t.score desc, t.distinct_cards desc) as rank,
           p.id, p.handle, p.display_name, p.avatar_url, t.score, t.distinct_cards, t.copies
    from totals t join public.profiles p on p.id = t.owner_id
  )
  select * from ranked
  where rank <= p_limit or id = (select auth.uid())
  order by rank, display_name;
$$;

/* ---------- Grants ---------- */

revoke execute on function public.slugify_handle(text) from public, anon, authenticated;
revoke execute on function public.unique_handle(text, uuid) from public, anon, authenticated;
revoke execute on function public.set_garage(uuid[]) from public, anon;
revoke execute on function public.mark_notifications_read() from public, anon;
revoke execute on function public.create_trade(uuid, uuid[], uuid[]) from public, anon;
revoke execute on function public.respond_trade(uuid, boolean) from public, anon;
revoke execute on function public.open_pack(text) from public, anon;
grant execute on function public.set_garage(uuid[]) to authenticated;
grant execute on function public.mark_notifications_read() to authenticated;
grant execute on function public.create_trade(uuid, uuid[], uuid[]) to authenticated;
grant execute on function public.respond_trade(uuid, boolean) to authenticated;
grant execute on function public.open_pack(text) to authenticated;
grant execute on function public.leaderboard(int) to anon, authenticated;
