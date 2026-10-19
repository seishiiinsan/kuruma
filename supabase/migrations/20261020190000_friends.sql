-- Friends: a player asks, the other accepts. The trade page lists friends
-- only; any profile still offers a trade.

create table public.friendships (
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

-- One friendship per pair, whoever asked.
create unique index friendships_pair_idx on public.friendships
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id);

alter table public.friendships enable row level security;
create policy "Players read their friendships" on public.friendships
  for select to authenticated
  using ((select auth.uid()) in (requester_id, addressee_id));

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in (
    'trade_received', 'trade_accepted', 'trade_declined', 'trade_cancelled',
    'wish_shop', 'wish_used', 'wish_double', 'wish_market',
    'market_sold', 'market_expired', 'moderation', 'permit_up',
    'friend_request', 'friend_accepted'
  ));

-- Asks a player to be friends, or accepts their own pending request.
-- Returns the friendship status.
create function public.add_friend(p_to uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  f public.friendships;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_to is null or p_to = uid then
    raise exception 'cannot befriend yourself';
  end if;
  if not exists (select 1 from public.profiles where id = p_to) then
    raise exception 'unknown player';
  end if;

  select * into f from public.friendships
  where (requester_id = uid and addressee_id = p_to) or (requester_id = p_to and addressee_id = uid)
  for update;
  if found then
    if f.status = 'pending' and f.addressee_id = uid then
      update public.friendships set status = 'accepted', accepted_at = now()
        where requester_id = p_to and addressee_id = uid;
      insert into public.notifications (user_id, kind, actor_id) values (p_to, 'friend_accepted', uid);
      return 'accepted';
    end if;
    return f.status;
  end if;

  if (select count(*) from public.friendships where requester_id = uid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'daily friend limit';
  end if;
  insert into public.friendships (requester_id, addressee_id) values (uid, p_to);
  insert into public.notifications (user_id, kind, actor_id) values (p_to, 'friend_request', uid);
  return 'pending';
end;
$$;

-- Removes a friend, cancels one's request or declines one received.
create function public.remove_friend(p_other uuid)
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
  delete from public.friendships
  where (requester_id = uid and addressee_id = p_other) or (requester_id = p_other and addressee_id = uid);
  -- The request's notification goes with it.
  delete from public.notifications
  where kind = 'friend_request' and user_id in (uid, p_other) and actor_id in (uid, p_other);
end;
$$;

-- Account export gains friendships.
create or replace function public.export_my_data()
returns jsonb
language plpgsql
stable
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
    'exported_at', now(),
    'account', (
      select jsonb_build_object(
        'id', u.id,
        'email', u.email,
        'created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at,
        'provider', u.raw_app_meta_data -> 'provider'
      )
      from auth.users u where u.id = uid
    ),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'wallet', (select to_jsonb(w) - 'user_id' from public.pack_wallets w where w.user_id = uid),
    'cards', coalesce((
      select jsonb_agg(to_jsonb(c) - 'owner_id' order by c.obtained_at)
      from public.card_copies c where c.owner_id = uid
    ), '[]'),
    'garage', coalesce((
      select jsonb_agg(to_jsonb(g) - 'user_id' order by g.position)
      from public.garage_slots g where g.user_id = uid
    ), '[]'),
    'pack_openings', coalesce((
      select jsonb_agg(to_jsonb(o) - 'user_id' order by o.opened_at)
      from public.pack_openings o where o.user_id = uid
    ), '[]'),
    'coin_ledger', coalesce((
      select jsonb_agg(to_jsonb(l) - 'user_id' order by l.id)
      from public.coin_ledger l where l.user_id = uid
    ), '[]'),
    'shop_purchases', coalesce((
      select jsonb_agg(to_jsonb(s) - 'user_id' order by s.created_at)
      from public.shop_purchases s where s.user_id = uid
    ), '[]'),
    'market_listings', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.listed_at)
      from public.market_listings m where m.seller_id = uid
    ), '[]'),
    'market_sales', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.sold_at)
      from public.market_sales m where uid in (m.seller_id, m.buyer_id)
    ), '[]'),
    'trades', coalesce((
      select jsonb_agg(
        to_jsonb(t) || jsonb_build_object('items', coalesce((
          select jsonb_agg(to_jsonb(i) - 'trade_id')
          from public.trade_items i where i.trade_id = t.id
        ), '[]'))
        order by t.created_at
      )
      from public.trades t where uid in (t.from_id, t.to_id)
    ), '[]'),
    'wishes', coalesce((
      select jsonb_agg(to_jsonb(w) - 'user_id' order by w.created_at)
      from public.wishes w where w.user_id = uid
    ), '[]'),
    'notifications', coalesce((
      select jsonb_agg(to_jsonb(n) - 'user_id' order by n.created_at)
      from public.notifications n where n.user_id = uid
    ), '[]'),
    'achievement_claims', coalesce((
      select jsonb_agg(to_jsonb(a) - 'user_id' order by a.claimed_at)
      from public.achievement_claims a where a.user_id = uid
    ), '[]'),
    'series_claims', coalesce((
      select jsonb_agg(to_jsonb(s) - 'user_id' order by s.claimed_at)
      from public.series_claims s where s.user_id = uid
    ), '[]'),
    'mission_claims', coalesce((
      select jsonb_agg(to_jsonb(m) - 'user_id' order by m.claimed_at)
      from public.mission_claims m where m.user_id = uid
    ), '[]'),
    'salon_claims', coalesce((
      select jsonb_agg(to_jsonb(s) - 'user_id' order by s.claimed_at)
      from public.salon_claims s where s.user_id = uid
    ), '[]'),
    'cosmetics', coalesce((
      select jsonb_agg(to_jsonb(c) - 'user_id' order by c.obtained_at)
      from public.player_cosmetics c where c.user_id = uid
    ), '[]'),
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player', case when f.requester_id = uid then f.addressee_id else f.requester_id end,
        'requested_by_me', f.requester_id = uid,
        'status', f.status,
        'created_at', f.created_at,
        'accepted_at', f.accepted_at
      ) order by f.created_at)
      from public.friendships f where uid in (f.requester_id, f.addressee_id)
    ), '[]'),
    'waitlist', coalesce((
      select jsonb_agg(to_jsonb(w) - 'user_id' order by w.created_at)
      from public.waitlist_signups w where w.user_id = uid
    ), '[]')
  );
end;
$$;

revoke execute on function public.add_friend(uuid) from public, anon;
revoke execute on function public.remove_friend(uuid) from public, anon;
grant execute on function public.add_friend(uuid) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
