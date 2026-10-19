-- The quote (cote) of a car no longer hangs on its rarity alone. Its base
-- value starts from the rarity's second-hand price, then:
-- - scarcity: units built against the median of its rarity, power 0.35
--   (x0.5 to x4): a one-off legendary is worth far more than a 200-unit one;
-- - exhaustion: as the game's copies run out, up to x1.6 once sold out;
-- - demand: players who wish for it, up to x1.6;
-- - offer: copies listed on the market weigh it down, to x0.8.
-- Player sales then take over little by little: each seller-buyer pair of
-- the last 30 days counts once, weight n / (n + 3).
-- Every number here must match lib/market.ts.

drop function public.market_quote(text);

create function public.market_quote(p_slug text)
returns table (
  reference int,
  min_price int,
  max_price int,
  sales int,
  base int,
  tier_price int,
  scarcity real,
  exhaustion real,
  demand real,
  offer real,
  market_median int
)
language sql
stable
security definer
set search_path = ''
as $$
  with k as (
    select c.tier, c.supply, c.minted from public.cards c where c.slug = p_slug
  ),
  med as (
    select percentile_cont(0.5) within group (order by c.supply) as supply
    from public.cards c, k
    where c.tier = k.tier and c.supply is not null
  ),
  f as (
    select public.used_price(k.tier) as tier_price,
           case when k.supply is null or med.supply is null then 1
                else least(4, greatest(0.5, power(med.supply / k.supply, 0.35))) end as scarcity,
           case when k.supply is null then 1
                else 1 + 0.6 * power(least(1, k.minted::float8 / k.supply), 3) end as exhaustion,
           least(1.6, 1 + 0.15 * ln(1 + (select count(*) from public.wishes w where w.card_slug = p_slug))) as demand,
           greatest(0.8, 1 - 0.04 * (
             select count(*) from public.market_listings l where l.card_slug = p_slug and l.expires_at > now()
           )) as offer,
           public.sell_price(k.tier) as floor_price
    from k, med
  ),
  pairs as (
    select distinct on (s.seller_id, s.buyer_id) s.price
    from public.market_sales s
    where s.card_slug = p_slug and s.sold_at > now() - interval '30 days'
    order by s.seller_id, s.buyer_id, s.sold_at desc
  ),
  m as (
    select count(*)::int as n, percentile_cont(0.5) within group (order by price) as median from pairs
  ),
  q as (
    select f.*,
           greatest(1, round(f.tier_price * f.scarcity * f.exhaustion * f.demand * f.offer))::int as base,
           m.n,
           m.median
    from f, m
  ),
  r as (
    select q.*,
           greatest(q.floor_price, round(
             case when q.n = 0 then q.base
                  else (q.base * 3 + q.median * q.n) / (q.n + 3) end
           ))::int as ref
    from q
  )
  select r.ref, r.floor_price, greatest(r.floor_price, r.ref * 3), r.n, r.base, r.tier_price,
         r.scarcity::real, r.exhaustion::real, r.demand::real, r.offer::real,
         round(r.median)::int
  from r;
$$;

grant execute on function public.market_quote(text) to anon, authenticated;
