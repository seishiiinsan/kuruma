-- Friends on the profile: anyone signed in sees a player's friends (and so
-- the ones they share), and the leaderboard can rank the viewer's friends.

-- A player's accepted friends, banned players left out. RLS keeps the table
-- to its two members; this reads one player's list for their profile.
create function public.player_friends(p_player uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case when f.requester_id = p_player then f.addressee_id else f.requester_id end
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = p_player then f.addressee_id else f.requester_id end
  where f.status = 'accepted'
    and p_player in (f.requester_id, f.addressee_id)
    and (p.banned_until is null or p.banned_until <= now());
$$;

-- The leaderboard also returns the players in p_with, wherever they rank,
-- so the friends ranking keeps everyone's global rank.
drop function public.leaderboard(int);
create function public.leaderboard(p_limit int default 50, p_with uuid[] default null)
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
  where rank <= least(greatest(coalesce(p_limit, 50), 1), 1000)
     or id = (select auth.uid())
     or id = any(coalesce(p_with, '{}'))
  order by rank, display_name;
$$;

revoke execute on function public.player_friends(uuid) from public, anon;
grant execute on function public.player_friends(uuid) to authenticated;
revoke execute on function public.leaderboard(int, uuid[]) from public;
grant execute on function public.leaderboard(int, uuid[]) to anon, authenticated;
