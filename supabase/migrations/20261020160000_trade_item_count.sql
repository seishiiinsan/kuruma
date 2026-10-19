-- A pending trade remembers how many copies it holds. When a copy of a
-- pending trade is deleted (its car leaves the catalogue, its owner deletes
-- their account…), its trade_items row goes with it (on delete cascade), so
-- respond_trade could not tell the trade had lost a card and handed the other
-- side's copies over for nothing. It now compares against the count stored at
-- creation and expires the trade instead.

alter table public.trades add column item_count smallint check (item_count between 2 and 10);

update public.trades t
  set item_count = (select count(*) from public.trade_items i where i.trade_id = t.id);

create or replace function public.create_trade(p_to uuid, p_give uuid[], p_take uuid[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  tid uuid;
  give_value bigint;
  take_value bigint;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_to is null or p_to = uid then
    raise exception 'cannot trade with yourself';
  end if;
  if coalesce(array_length(p_give, 1), 0) not between 1 and 5
     or coalesce(array_length(p_take, 1), 0) not between 1 and 5 then
    raise exception 'a trade has 1 to 5 cards on each side';
  end if;
  if (select count(*) from public.card_copies where id = any (p_give) and owner_id = uid) <> array_length(p_give, 1)
     or (select count(*) from public.card_copies where id = any (p_take) and owner_id = p_to) <> array_length(p_take, 1) then
    raise exception 'cards changed hands';
  end if;

  perform public.assert_trusted(uid);
  if public.trade_block(p_to) is not null then
    raise exception 'partner cannot trade';
  end if;
  if (select count(*) from public.trades where from_id = uid and status = 'pending') >= 20 then
    raise exception 'too many pending trades';
  end if;
  if (select count(*) from public.trades where from_id = uid and created_at > now() - interval '1 day') >= 10 then
    raise exception 'daily trade limit';
  end if;

  -- Young accounts: no gift dressed up as a trade.
  if exists (select 1 from public.profiles where id in (uid, p_to) and created_at > now() - interval '30 days') then
    give_value := public.copies_value(p_give);
    take_value := public.copies_value(p_take);
    if greatest(give_value, take_value) > 3 * greatest(least(give_value, take_value), 1) then
      raise exception 'unbalanced trade';
    end if;
  end if;

  insert into public.trades (from_id, to_id, item_count)
    values (uid, p_to, array_length(p_give, 1) + array_length(p_take, 1))
    returning id into tid;
  insert into public.trade_items (trade_id, copy_id, side)
    select tid, unnest(p_give), 'give'
    union all
    select tid, unnest(p_take), 'take';
  insert into public.notifications (user_id, kind, actor_id, trade_id)
    values (p_to, 'trade_received', uid, tid);
  return tid;
end;
$$;

create or replace function public.respond_trade(p_trade uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  accept boolean := coalesce(p_accept, false);
  t public.trades;
  valid boolean;
  moved uuid[];
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into t from public.trades where id = p_trade for update;
  if not found or t.status <> 'pending' then
    raise exception 'trade is not pending';
  end if;

  if uid = t.from_id and not accept then
    update public.trades set status = 'cancelled', resolved_at = now() where id = p_trade;
    insert into public.notifications (user_id, kind, actor_id, trade_id)
      values (t.to_id, 'trade_cancelled', uid, p_trade);
    return 'cancelled';
  end if;

  if uid is distinct from t.to_id then
    raise exception 'not your trade';
  end if;

  if not accept then
    update public.trades set status = 'declined', resolved_at = now() where id = p_trade;
    insert into public.notifications (user_id, kind, actor_id, trade_id)
      values (t.from_id, 'trade_declined', uid, p_trade);
    return 'declined';
  end if;

  perform public.assert_trusted(uid);
  if public.trade_block(t.from_id) is not null then
    raise exception 'partner cannot trade';
  end if;
  if public.trades_today(uid) >= 10 or public.trades_today(t.from_id) >= 10 then
    raise exception 'daily trade limit';
  end if;
  if (
    select count(*) from public.trades
    where status = 'accepted' and resolved_at > now() - interval '7 days'
      and ((from_id = t.from_id and to_id = t.to_id) or (from_id = t.to_id and to_id = t.from_id))
  ) >= 3 then
    raise exception 'pair limit';
  end if;

  -- Lock every copy in the trade, then check nobody traded them away or
  -- deleted them since (a deleted copy takes its trade_items row with it).
  perform 1 from public.card_copies c
    join public.trade_items i on i.copy_id = c.id
    where i.trade_id = p_trade
    for update of c;

  select bool_and(
    (i.side = 'give' and c.owner_id = t.from_id) or (i.side = 'take' and c.owner_id = t.to_id)
  ) into valid
  from public.trade_items i join public.card_copies c on c.id = i.copy_id
  where i.trade_id = p_trade;

  if not coalesce(valid, false)
     or coalesce(t.item_count, (select count(*) from public.trade_items where trade_id = p_trade))
        <> (select count(*) from public.trade_items i join public.card_copies c on c.id = i.copy_id where i.trade_id = p_trade) then
    update public.trades set status = 'expired', resolved_at = now() where id = p_trade;
    return 'expired';
  end if;

  update public.card_copies c
    set owner_id = case i.side when 'give' then t.to_id else t.from_id end,
        obtained_at = now(),
        obtained_via = 'trade'
    from public.trade_items i
    where i.trade_id = p_trade and i.copy_id = c.id;

  select array_agg(copy_id) into moved from public.trade_items where trade_id = p_trade;

  delete from public.garage_slots where copy_id = any (moved);

  update public.trades set status = 'accepted', resolved_at = now() where id = p_trade;
  insert into public.notifications (user_id, kind, actor_id, trade_id)
    values (t.from_id, 'trade_accepted', uid, p_trade);

  -- Other offers built on these copies can no longer happen.
  update public.trades set status = 'expired', resolved_at = now()
    where status = 'pending' and id <> p_trade
      and exists (select 1 from public.trade_items i where i.trade_id = trades.id and i.copy_id = any (moved));

  return 'accepted';
end;
$$;
