-- Profile cosmetics: a title, up to three badges, an avatar frame and a
-- profile banner. Each is unlocked by playing (a player_metrics value
-- reaching a goal) or bought with jetons, never both. Unlocks are granted
-- once and kept, even if the metric drops later.
-- Every id, price and goal here must match lib/cosmetics.ts.

create table public.cosmetics (
  id text primary key,
  kind text not null check (kind in ('title', 'badge', 'frame', 'banner')),
  price int check (price > 0),
  metric text,
  goal int check (goal > 0),
  check ((price is null) <> (metric is null)),
  check ((metric is null) = (goal is null))
);

create table public.player_cosmetics (
  user_id uuid not null references auth.users (id) on delete cascade,
  cosmetic_id text not null references public.cosmetics (id) on delete cascade,
  via text not null check (via in ('unlock', 'shop')),
  obtained_at timestamptz not null default now(),
  primary key (user_id, cosmetic_id)
);

alter table public.cosmetics enable row level security;
alter table public.player_cosmetics enable row level security;
create policy "Cosmetics are public" on public.cosmetics for select to anon, authenticated using (true);
create policy "Player cosmetics are public" on public.player_cosmetics for select to anon, authenticated using (true);

insert into public.cosmetics (id, kind, price, metric, goal) values
  ('title-premier-pack', 'title', null, 'packs', 1),
  ('title-dechireur', 'title', null, 'packs', 100),
  ('title-collectionneur', 'title', null, 'cards', 100),
  ('title-conservateur', 'title', null, 'cards', 1000),
  ('title-legende', 'title', null, 'legendaries', 1),
  ('title-mythe', 'title', null, 'legendaries', 25),
  ('title-troc', 'title', null, 'trades', 15),
  ('title-archiviste', 'title', null, 'series', 10),
  ('title-globe-trotter', 'title', null, 'cultures', 8),
  ('title-premiere-main', 'title', null, 'serials', 10),
  ('title-habitue', 'title', null, 'days', 30),
  ('title-pilier', 'title', null, 'days', 365),
  ('title-pilote-usine', 'title', null, 'score', 50000),
  ('title-ferrailleur', 'title', null, 'sold', 100),
  ('title-dimanche', 'title', 150, null, null),
  ('title-circuit', 'title', 400, null, null),
  ('title-drift', 'title', 800, null, null),
  ('title-gentleman', 'title', 1500, null, null),
  ('title-chef-ecurie', 'title', 4000, null, null),
  ('badge-premier-pack', 'badge', null, 'packs', 1),
  ('badge-epiques', 'badge', null, 'epics', 5),
  ('badge-legende', 'badge', null, 'legendaries', 1),
  ('badge-echange', 'badge', null, 'trades', 1),
  ('badge-album', 'badge', null, 'series', 1),
  ('badge-numero-un', 'badge', null, 'serials', 1),
  ('badge-semaine', 'badge', null, 'days', 7),
  ('badge-garage', 'badge', null, 'garage', 6),
  ('badge-client', 'badge', null, 'bought', 10),
  ('badge-monde', 'badge', null, 'cultures', 5),
  ('badge-podium', 'badge', null, 'score', 20000),
  ('badge-cle', 'badge', 250, null, null),
  ('badge-jauge', 'badge', 300, null, null),
  ('badge-plein', 'badge', 450, null, null),
  ('badge-damier', 'badge', 600, null, null),
  ('badge-eclair', 'badge', 900, null, null),
  ('badge-fusee', 'badge', 1400, null, null),
  ('badge-etoile', 'badge', 3000, null, null),
  ('frame-bronze', 'frame', null, 'cards', 25),
  ('frame-argent', 'frame', null, 'series', 3),
  ('frame-or', 'frame', null, 'legendaries', 10),
  ('frame-violet', 'frame', null, 'epics', 40),
  ('frame-carbone', 'frame', 500, null, null),
  ('frame-damier', 'frame', 900, null, null),
  ('frame-neon', 'frame', 1200, null, null),
  ('frame-holo', 'frame', 2500, null, null),
  ('banner-bitume', 'banner', null, 'cards', 250),
  ('banner-aube', 'banner', null, 'days', 100),
  ('banner-paddock', 'banner', null, 'trades', 40),
  ('banner-route-66', 'banner', 800, null, null),
  ('banner-tokyo', 'banner', 1000, null, null),
  ('banner-ring', 'banner', 1500, null, null),
  ('banner-aurore', 'banner', 2000, null, null);

/* ---------- What a player wears ---------- */

alter table public.profiles
  add column title_id text references public.cosmetics (id) on delete set null,
  add column frame_id text references public.cosmetics (id) on delete set null,
  add column banner_id text references public.cosmetics (id) on delete set null,
  add column badge_ids text[] not null default '{}' check (cardinality(badge_ids) <= 3);

grant select (title_id, frame_id, banner_id, badge_ids) on public.profiles to anon, authenticated;

alter table public.coin_ledger drop constraint coin_ledger_reason_check;
alter table public.coin_ledger add constraint coin_ledger_reason_check
  check (reason in ('daily', 'achievement', 'sell', 'pack', 'shop', 'mission', 'market', 'cosmetic'));

/* ---------- Unlocks, purchases, equipping ---------- */

-- Grants every cosmetic whose goal the player has reached; returns the new ones.
create function public.unlock_cosmetics(p_user uuid)
returns setof text
language sql
security definer
set search_path = ''
as $$
  with m as (select public.player_metrics(p_user) as v)
  insert into public.player_cosmetics (user_id, cosmetic_id, via)
  select p_user, c.id, 'unlock'
  from public.cosmetics c, m
  where c.metric is not null and coalesce((m.v ->> c.metric)::int, 0) >= c.goal
  on conflict do nothing
  returning cosmetic_id;
$$;

revoke execute on function public.unlock_cosmetics(uuid) from public, anon, authenticated;

-- The signed-in player's cosmetics, after granting what they just reached.
create function public.my_cosmetics()
returns table (cosmetic_id text, via text, obtained_at timestamptz, fresh boolean)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  fresh_ids text[];
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  select coalesce(array_agg(id), '{}') into fresh_ids from public.unlock_cosmetics(uid) as id;
  return query
    select pc.cosmetic_id, pc.via, pc.obtained_at, pc.cosmetic_id = any (fresh_ids)
    from public.player_cosmetics pc
    where pc.user_id = uid
    order by pc.obtained_at desc;
end;
$$;

create function public.buy_cosmetic(p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  c public.cosmetics;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  select * into c from public.cosmetics where id = p_id;
  if not found then
    raise exception 'unknown cosmetic';
  end if;
  if c.price is null then
    raise exception 'not for sale';
  end if;
  insert into public.player_cosmetics (user_id, cosmetic_id, via) values (uid, c.id, 'shop')
    on conflict do nothing;
  if not found then
    raise exception 'already owned';
  end if;
  perform public.move_coins(uid, -c.price, 'cosmetic', c.id);
end;
$$;

create function public.owns_cosmetic(p_user uuid, p_id text, p_kind text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.player_cosmetics pc join public.cosmetics c on c.id = pc.cosmetic_id
    where pc.user_id = p_user and pc.cosmetic_id = p_id and c.kind = p_kind
  );
$$;

-- Sets the whole look at once; null takes a slot off.
create function public.equip_cosmetics(p_title text, p_frame text, p_banner text, p_badges text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  badges text[] := coalesce(p_badges, '{}');
  badge text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if cardinality(badges) > 3 then
    raise exception 'too many badges';
  end if;
  if cardinality(badges) <> (select count(distinct x) from unnest(badges) as x) then
    raise exception 'duplicate badge';
  end if;
  if (p_title is not null and not public.owns_cosmetic(uid, p_title, 'title'))
     or (p_frame is not null and not public.owns_cosmetic(uid, p_frame, 'frame'))
     or (p_banner is not null and not public.owns_cosmetic(uid, p_banner, 'banner')) then
    raise exception 'not owned';
  end if;
  foreach badge in array badges loop
    if not public.owns_cosmetic(uid, badge, 'badge') then
      raise exception 'not owned';
    end if;
  end loop;

  update public.profiles
    set title_id = p_title, frame_id = p_frame, banner_id = p_banner, badge_ids = badges, updated_at = now()
    where id = uid;
end;
$$;

-- Players who already reached goals get them now.
insert into public.player_cosmetics (user_id, cosmetic_id, via)
select p.id, c.id, 'unlock'
from public.profiles p
cross join lateral (select public.player_metrics(p.id) as v) m
join public.cosmetics c on c.metric is not null and coalesce((m.v ->> c.metric)::int, 0) >= c.goal
on conflict do nothing;
