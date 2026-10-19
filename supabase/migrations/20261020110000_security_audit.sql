-- Security audit of every function in public.
--
-- On Supabase, a new function in public is executable by anon and
-- authenticated through default privileges, not only through PUBLIC: a
-- function no migration revoked stays callable by signed-out visitors, from
-- the browser, with the publishable key. This migration:
-- 1. stops that default for functions created from now on;
-- 2. states, function by function, who may call what;
-- 3. tightens the few checks a direct call could get around.
--
-- Audit result (every security definer function reads auth.uid() itself and
-- never trusts a user id passed in):
-- - player actions (open_pack, claim_*, buy_*, sell_*, list_copy,
--   cancel_listing, create_trade, respond_trade, set_garage, set_wish,
--   equip_cosmetics, buy_cosmetic, delete_own_account): signed-in only, each
--   raises 'not authenticated' without a session;
-- - player reads (my_*, shop_window): signed-in only;
-- - internal helpers taking a p_user (move_coins, player_metrics,
--   mission_board, salon_board, unlock_cosmetics, sell_to_shop…): nobody,
--   they only run from inside the functions above;
-- - public reads (leaderboard, market_quote, market_history, salon_now,
--   weekend_pack…) and pure price formulas: everyone.
-- Gaps fixed here: buy_cosmetic, equip_cosmetics, my_cosmetics and
-- owns_cosmetic were never revoked from anon; the waitlist let visitors
-- insert a row for any user id. Fixed in the next migration, which rewrites
-- these functions anyway: respond_trade did not check the session up front
-- and read a null p_accept as "accept"; leaderboard had no cap on p_limit;
-- list_copy let a null price reach the insert.

/* ---------- 1. No more implicit EXECUTE for visitors ---------- */

alter default privileges for role postgres in schema public revoke execute on functions from public, anon;

/* ---------- 2. Who may call what ---------- */

-- Internal helpers: only other functions call them.
revoke execute on function public.move_coins(uuid, int, text, text) from public, anon, authenticated;
revoke execute on function public.ensure_shop_offers() from public, anon, authenticated;
revoke execute on function public.expire_listings() from public, anon, authenticated;
revoke execute on function public.sellable(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.sell_to_shop(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.player_metrics(uuid) from public, anon, authenticated;
revoke execute on function public.claimable_achievements(uuid) from public, anon, authenticated;
revoke execute on function public.mission_progress(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.mission_board(uuid) from public, anon, authenticated;
revoke execute on function public.salon_board(uuid) from public, anon, authenticated;
revoke execute on function public.salon_ready(uuid) from public, anon, authenticated;
revoke execute on function public.notify_wishers(text, text, uuid) from public, anon, authenticated;
revoke execute on function public.unlock_cosmetics(uuid) from public, anon, authenticated;
revoke execute on function public.owns_cosmetic(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.slugify_handle(text) from public, anon, authenticated;
revoke execute on function public.unique_handle(text, uuid) from public, anon, authenticated;

-- Triggers: Postgres fires them whatever the grants.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_metadata_update() from public, anon, authenticated;
revoke execute on function public.on_copy_owner() from public, anon, authenticated;
revoke execute on function public.on_shop_stock() from public, anon, authenticated;
revoke execute on function public.on_shop_offer() from public, anon, authenticated;

-- Signed-in players only.
revoke execute on function public.delete_own_account() from public, anon;
revoke execute on function public.my_pack_wallet() from public, anon;
revoke execute on function public.open_pack(text, boolean) from public, anon;
revoke execute on function public.claim_daily() from public, anon;
revoke execute on function public.claim_achievements() from public, anon;
revoke execute on function public.claim_missions() from public, anon;
revoke execute on function public.claim_salon() from public, anon;
revoke execute on function public.claim_series(text) from public, anon;
revoke execute on function public.my_metrics() from public, anon;
revoke execute on function public.my_missions() from public, anon;
revoke execute on function public.my_salon() from public, anon;
revoke execute on function public.my_cosmetics() from public, anon;
revoke execute on function public.shop_window() from public, anon;
revoke execute on function public.buy_offer(text, int) from public, anon;
revoke execute on function public.buy_used(uuid) from public, anon;
revoke execute on function public.buy_cosmetic(text) from public, anon;
revoke execute on function public.equip_cosmetics(text, text, text, text[]) from public, anon;
revoke execute on function public.sell_copy(uuid) from public, anon;
revoke execute on function public.sell_duplicates(text) from public, anon;
revoke execute on function public.list_copy(uuid, int) from public, anon;
revoke execute on function public.cancel_listing(uuid) from public, anon;
revoke execute on function public.buy_listing(uuid) from public, anon;
revoke execute on function public.create_trade(uuid, uuid[], uuid[]) from public, anon;
revoke execute on function public.respond_trade(uuid, boolean) from public, anon;
revoke execute on function public.set_garage(uuid[]) from public, anon;
revoke execute on function public.set_wish(text, boolean) from public, anon;
revoke execute on function public.mark_notifications_read() from public, anon;
revoke execute on function public.mark_notification_read(uuid) from public, anon;

grant execute on function public.delete_own_account() to authenticated;
grant execute on function public.my_pack_wallet() to authenticated;
grant execute on function public.open_pack(text, boolean) to authenticated;
grant execute on function public.claim_daily() to authenticated;
grant execute on function public.claim_achievements() to authenticated;
grant execute on function public.claim_missions() to authenticated;
grant execute on function public.claim_salon() to authenticated;
grant execute on function public.claim_series(text) to authenticated;
grant execute on function public.my_metrics() to authenticated;
grant execute on function public.my_missions() to authenticated;
grant execute on function public.my_salon() to authenticated;
grant execute on function public.my_cosmetics() to authenticated;
grant execute on function public.shop_window() to authenticated;
grant execute on function public.buy_offer(text, int) to authenticated;
grant execute on function public.buy_used(uuid) to authenticated;
grant execute on function public.buy_cosmetic(text) to authenticated;
grant execute on function public.equip_cosmetics(text, text, text, text[]) to authenticated;
grant execute on function public.sell_copy(uuid) to authenticated;
grant execute on function public.sell_duplicates(text) to authenticated;
grant execute on function public.list_copy(uuid, int) to authenticated;
grant execute on function public.cancel_listing(uuid) to authenticated;
grant execute on function public.buy_listing(uuid) to authenticated;
grant execute on function public.create_trade(uuid, uuid[], uuid[]) to authenticated;
grant execute on function public.respond_trade(uuid, boolean) to authenticated;
grant execute on function public.set_garage(uuid[]) to authenticated;
grant execute on function public.set_wish(text, boolean) to authenticated;
grant execute on function public.mark_notifications_read() to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;

-- Public reads and price formulas: no session needed, nothing private.
grant execute on function public.leaderboard(int) to anon, authenticated;
grant execute on function public.market_fee(int) to anon, authenticated;
grant execute on function public.market_quote(text) to anon, authenticated;
grant execute on function public.market_history(text, int) to anon, authenticated;
grant execute on function public.salon_week(int, int, int, int) to anon, authenticated;
grant execute on function public.salon_now() to anon, authenticated;
grant execute on function public.weekend_pack() to anon, authenticated;
grant execute on function public.shop_periods() to anon, authenticated;
grant execute on function public.paris_today() to anon, authenticated;
grant execute on function public.tier_points(text) to anon, authenticated;
grant execute on function public.shop_price(text) to anon, authenticated;
grant execute on function public.used_price(text) to anon, authenticated;
grant execute on function public.sell_price(text) to anon, authenticated;
grant execute on function public.daily_reward(int) to anon, authenticated;

/* ---------- 3. Checks a direct call could get around ---------- */

-- Visitors could insert a waitlist row carrying someone's user id.
drop policy "Allow public insert" on public.waitlist_signups;
create policy "Allow public insert" on public.waitlist_signups
  for insert to anon
  with check (user_id is null);
