-- Launch: trades open early too.
--
-- Like the market (20261020180000_launch_market.sql), trades no longer wait
-- 3 days and a 30-day-old Discord account during the launch: 10 boosters
-- opened are enough. Every other rule stays: 10 trades a day, 3 trades a
-- week between the same two players, and while either side is under 30 days
-- old, both sides stay within 3x at the quote. Banned players stay out.
--
-- Every number here must match lib/trust.ts.

-- Why a player can't pass cards or jetons to others; null when they can.
-- p_at only moves the launch window, for tests.
create function public.trade_block_at(p_user uuid, p_at timestamptz)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with base as (
    select case
      when p.id is null then 'not authenticated'
      when p.banned_until > now() then 'account banned'
      when p.created_at > now() - interval '3 days' then 'account too new'
      when public.discord_created_at(p.discord_id) > now() - interval '30 days' then 'discord too new'
    end as reason
    from (select 1) one
    left join public.profiles p on p.id = p_user
  )
  select case
    when reason is null or reason in ('account banned', 'not authenticated') then reason
    when p_at >= public.launch_market_until() then reason
    when (select count(*) from public.pack_openings where user_id = p_user) >= 10 then null
    else 'launch packs'
  end
  from base;
$$;

create or replace function public.trade_block(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.trade_block_at(p_user, now());
$$;

-- The market now follows the same gate.
create or replace function public.market_block(p_user uuid, p_at timestamptz default now())
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.trade_block_at(p_user, p_at);
$$;

revoke execute on function public.trade_block_at(uuid, timestamptz) from public, anon, authenticated;
