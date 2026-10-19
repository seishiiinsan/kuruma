-- Lets a signed-in user download everything the game stores about them
-- (GDPR right of access and portability). Security definer so the export
-- doesn't depend on each table's RLS policies or column grants.
create function public.export_my_data()
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
    'waitlist', coalesce((
      select jsonb_agg(to_jsonb(w) - 'user_id' order by w.created_at)
      from public.waitlist_signups w where w.user_id = uid
    ), '[]')
  );
end;
$$;

revoke execute on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
