-- Richer collection: rare finishes on the same car, and the chain of players
-- each numbered copy went through.
-- Odds here must match FINISHES in lib/cards.ts.

/* ---------- Finishes ---------- */

-- 'holo': rainbow foil. 'vintage': "photo d'époque", an old print look.
-- Rolled once when the copy is minted, never changed after.
alter table public.card_copies
  add column finish text not null default 'standard'
    check (finish in ('standard', 'holo', 'vintage'));

create function public.roll_finish()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  roll double precision := random();
begin
  new.finish := case
    when roll < 0.04 then 'holo'
    when roll < 0.06 then 'vintage'
    else 'standard'
  end;
  return new;
end;
$$;

create trigger card_copies_finish
  before insert on public.card_copies
  for each row execute function public.roll_finish();

/* ---------- Provenance ---------- */

-- One row each time a copy lands with a new owner. Time spent listed or in
-- the shop (owner_id null) is not a change of hands and leaves no row; a
-- copy coming back to its seller unsold leaves none either.
create table public.copy_history (
  id bigint generated always as identity primary key,
  copy_id uuid not null references public.card_copies (id) on delete cascade,
  -- null once that player deleted their account.
  owner_id uuid references auth.users (id) on delete set null,
  via text not null check (via in ('pack', 'trade', 'shop', 'market')),
  at timestamptz not null default now()
);

create index copy_history_copy_idx on public.copy_history (copy_id, at, id);

alter table public.copy_history enable row level security;
create policy "Copy history is public" on public.copy_history for select to anon, authenticated using (true);

create function public.on_copy_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is null then
    return null;
  end if;
  if new.owner_id is not distinct from (
    select h.owner_id from public.copy_history h
    where h.copy_id = new.id
    order by h.at desc, h.id desc
    limit 1
  ) then
    return null;
  end if;
  insert into public.copy_history (copy_id, owner_id, via)
    values (new.id, new.owner_id, new.obtained_via);
  return null;
end;
$$;

create trigger card_copies_history
  after insert or update of owner_id on public.card_copies
  for each row execute function public.on_copy_history();

revoke execute on function public.roll_finish() from public, anon, authenticated;
revoke execute on function public.on_copy_history() from public, anon, authenticated;

/* ---------- Backfill from what the game already recorded ---------- */

with events as (
  -- Pulled from a pack.
  select c.id as copy_id, o.user_id as owner_id, 'pack' as via, o.opened_at as at
  from public.pack_openings o
  cross join lateral unnest(o.copies) as u(copy_id)
  join public.card_copies c on c.id = u.copy_id
  union all
  -- Bought in the shop window or second-hand.
  select p.copy_id, p.user_id, 'shop', p.created_at
  from public.shop_purchases p
  where p.copy_id is not null
  union all
  -- Bought on the player market.
  select s.copy_id, s.buyer_id, 'market', s.sold_at
  from public.market_sales s
  where s.copy_id is not null and s.buyer_id is not null
  union all
  -- Swapped in an accepted trade.
  select i.copy_id,
         case i.side when 'give' then t.to_id else t.from_id end,
         'trade',
         t.resolved_at
  from public.trade_items i
  join public.trades t on t.id = i.trade_id
  where t.status = 'accepted' and t.resolved_at is not null
), ordered as (
  select e.*, lag(e.owner_id) over (partition by e.copy_id order by e.at) as previous
  from events e
)
insert into public.copy_history (copy_id, owner_id, via, at)
select copy_id, owner_id, via, at
from ordered
where previous is distinct from owner_id
order by at;

-- Copies whose current owner the records above don't reach.
insert into public.copy_history (copy_id, owner_id, via, at)
select c.id, c.owner_id, c.obtained_via, c.obtained_at
from public.card_copies c
where c.owner_id is not null
  and c.owner_id is distinct from (
    select h.owner_id from public.copy_history h
    where h.copy_id = c.id
    order by h.at desc, h.id desc
    limit 1
  );
