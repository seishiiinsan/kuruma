create table public.cards (
  slug text primary key,
  tier text not null check (tier in ('common', 'rare', 'epic', 'legendary')),
  culture text not null
);

insert into public.cards (slug, tier, culture) values
  ('shop-runner', 'common', 'Euro'),
  ('street-classic', 'common', 'Youngtimer'),
  ('silver-bullet-gt', 'rare', 'GT'),
  ('canyon-carver', 'rare', 'JDM'),
  ('midnight-rotary', 'epic', 'JDM'),
  ('apex-prototype', 'legendary', 'Hypercar');

create table public.packs (
  id text primary key,
  name text not null,
  themed_cultures text[] not null default '{}'
);

insert into public.packs (id, name, themed_cultures) values
  ('edition-01', 'Édition 01', '{}'),
  ('nuit-jdm', 'Nuit JDM', '{JDM}'),
  ('grand-tourisme', 'Grand Tourisme', '{GT,Hypercar}'),
  ('garage-classique', 'Garage Classique', '{Euro,Youngtimer}');

create table public.pack_wallets (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stored smallint not null default 10 check (stored between 0 and 10),
  anchor_at timestamptz not null default now()
);

create table public.pack_openings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pack_id text not null references public.packs (id),
  cards text[] not null,
  opened_at timestamptz not null default now()
);

create index pack_openings_user_opened_idx
  on public.pack_openings (user_id, opened_at desc);

alter table public.cards enable row level security;
alter table public.packs enable row level security;
alter table public.pack_wallets enable row level security;
alter table public.pack_openings enable row level security;

create policy "Signed-in players read cards" on public.cards
  for select to authenticated using (true);
create policy "Signed-in players read packs" on public.packs
  for select to authenticated using (true);
create policy "Players read their own wallet" on public.pack_wallets
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Players read their own openings" on public.pack_openings
  for select to authenticated using ((select auth.uid()) = user_id);

-- One free pack every 10 minutes (600 s), stacking up to 10. "stored" is the
-- count at "anchor_at"; packs earned since then are derived from the clock.
create function public.my_pack_wallet()
returns table (available int, next_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
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
    end;
end;
$$;

create function public.open_pack(p_pack text)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  themes text[];
  w public.pack_wallets;
  gained int;
  avail int;
  roll double precision;
  slot_tier text;
  pick text;
  pulled text[] := '{}';
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select themed_cultures into themes from public.packs where id = p_pack;
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
    -- The wallet was full, so the refill timer starts now.
    update public.pack_wallets
      set stored = 9, anchor_at = now()
      where user_id = uid;
  else
    -- Keep the partial progress towards the next pack.
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
      -- The fifth card is always rare or better.
      slot_tier := case
        when roll < 0.75 then 'rare'
        when roll < 0.94 then 'epic'
        else 'legendary'
      end;
    end if;

    -- Weighted pick within the tier: the pack's cultures weigh 4x.
    select slug into pick
    from public.cards
    where tier = slot_tier
    order by -ln(greatest(random(), 1e-12))
             / (case when culture = any (themes) then 4 else 1 end)
    limit 1;

    pulled := pulled || pick;
  end loop;

  insert into public.pack_openings (user_id, pack_id, cards)
  values (uid, p_pack, pulled);

  return pulled;
end;
$$;

revoke execute on function public.my_pack_wallet() from public, anon;
revoke execute on function public.open_pack(text) from public, anon;
grant execute on function public.my_pack_wallet() to authenticated;
grant execute on function public.open_pack(text) to authenticated;
