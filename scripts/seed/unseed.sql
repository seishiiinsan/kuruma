-- Retire les joueurs factices de scripts/seed/seed.sql et tout ce qui
-- n'appartient qu'à eux. Ce que le compte principal a reçu (cartes, jetons)
-- reste à lui.
--
--   npm run db:unseed

begin;

create temp table seed_ids on commit drop as
select id from auth.users where email like '%@seed.kuruma.test';

-- Their cars on the market and their duplicates sold to the shop belong to
-- nobody: they go with them.
delete from public.card_copies
where id in (select copy_id from public.market_listings where seller_id in (select id from seed_ids));

delete from public.card_copies c
where c.owner_id is null
  and c.id::text in (
    select ref from public.coin_ledger where reason = 'sell' and user_id in (select id from seed_ids));

-- Done step by step: left to the cascades of a single user deletion, the
-- set-null on market_sales runs after their copies are gone and fails.
update public.market_sales set seller_id = null where seller_id in (select id from seed_ids);
update public.market_sales set buyer_id = null where buyer_id in (select id from seed_ids);
delete from public.market_sales where seller_id is null and buyer_id is null;
delete from public.card_copies where owner_id in (select id from seed_ids);

delete from public.waitlist_signups where user_id in (select id from seed_ids);
delete from auth.users where id in (select id from seed_ids);

delete from public.shop_offers o
using public.shop_periods() p
where o.period not in (p.day, p.week)
  and not exists (select 1 from public.shop_purchases sp where sp.period = o.period and sp.slot = o.slot);

-- Serials stay unique: the next copy follows the highest one still held.
update public.cards c set minted = coalesce((select max(serial) from public.card_copies cc where cc.card_slug = c.slug), 0);

commit;

select count(*) as joueurs_restants from auth.users;
