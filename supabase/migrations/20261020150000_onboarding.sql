-- First launch: a new player goes through /bienvenue (first pack, rarity,
-- score, trades) once. Players already here skip it.

alter table public.profiles add column onboarded_at timestamptz;

update public.profiles set onboarded_at = now();

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
    'young', p.created_at > now() - interval '30 days',
    'proposed_today', (select count(*) from public.trades where from_id = p.id and created_at > now() - interval '1 day'),
    'traded_today', public.trades_today(p.id),
    'bought_today', (select count(*) from public.market_sales where buyer_id = p.id and sold_at > now() - interval '1 day'),
    'admin', exists (select 1 from public.admins a where a.user_id = p.id)
  )
  from public.profiles p
  where p.id = (select auth.uid());
$$;

create function public.finish_onboarding()
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
  update public.profiles set onboarded_at = coalesce(onboarded_at, now()) where id = uid;
end;
$$;

revoke execute on function public.finish_onboarding() from public, anon;
grant execute on function public.finish_onboarding() to authenticated;
