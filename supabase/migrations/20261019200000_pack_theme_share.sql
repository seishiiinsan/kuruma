-- Themed packs: a 4x weight left a Nuit JDM pack with barely two JDM out of
-- five, since the theme is a small slice of each tier. Each slot is now
-- themed on a fixed share instead, whatever the catalogue holds.

alter table public.packs
  add column theme_share real not null default 0 check (theme_share between 0 and 1);

update public.packs set theme_share = 0.8 where cardinality(themes) > 0;

alter table public.packs drop column theme_weight;

create or replace function public.open_pack(p_pack text, p_pay boolean default false)
returns table (copy_id uuid, card_slug text, serial int)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  uid uuid := (select auth.uid());
  pk public.packs;
  w public.pack_wallets;
  gained int;
  avail int;
  grp jsonb;
  odds jsonb;
  roll double precision;
  slot_tier text;
  pick text;
  themed boolean;
  minted_now int;
  new_copy uuid;
  pulled uuid[] := '{}';
  tiers text[] := array['common', 'rare', 'epic', 'legendary'];
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into pk from public.packs where id = p_pack;
  if not found then
    raise exception 'unknown pack';
  end if;

  insert into public.pack_wallets (user_id) values (uid) on conflict do nothing;
  select * into w from public.pack_wallets where user_id = uid for update;

  if pk.free and not p_pay then
    gained := floor(extract(epoch from (now() - w.anchor_at)) / 600)::int;
    avail := least(10, w.stored + gained);

    if avail >= 1 then
      if w.stored + gained >= 10 then
        update public.pack_wallets set stored = 9, anchor_at = now() where user_id = uid;
      else
        update public.pack_wallets
          set stored = avail - 1,
              anchor_at = w.anchor_at + make_interval(secs => gained * 600)
          where user_id = uid;
      end if;
    elsif w.bonus >= 1 then
      update public.pack_wallets set bonus = bonus - 1 where user_id = uid;
    else
      raise exception 'no packs available' using errcode = 'P0001';
    end if;
  else
    perform public.move_coins(uid, -pk.price, 'pack', pk.id);
  end if;

  for grp in select value from jsonb_array_elements(pk.slots) loop
    odds := grp -> 'odds';
    for i in 1..(grp ->> 'n')::int loop
      roll := random() * 100;
      slot_tier := case
        when roll < (odds ->> 0)::numeric then 'common'
        when roll < (odds ->> 0)::numeric + (odds ->> 1)::numeric then 'rare'
        when roll < (odds ->> 0)::numeric + (odds ->> 1)::numeric + (odds ->> 2)::numeric then 'epic'
        else 'legendary'
      end;

      pick := null;
      -- The slot is themed on a fixed share; a tier with no themed card left
      -- gives any card of that tier. A sold-out tier falls back to the next tier down.
      themed := cardinality(pk.themes) > 0 and random() < pk.theme_share;
      for t in reverse array_position(tiers, slot_tier)..1 loop
        if themed then
          select c.slug into pick
          from public.cards c
          where c.tier = tiers[t] and (c.supply is null or c.minted < c.supply) and c.traits && pk.themes
          order by random()
          limit 1;
        end if;
        if pick is null then
          select c.slug into pick
          from public.cards c
          where c.tier = tiers[t] and (c.supply is null or c.minted < c.supply)
          order by random()
          limit 1;
        end if;
        exit when pick is not null;
      end loop;

      if pick is null then
        raise exception 'catalogue sold out';
      end if;

      update public.cards set minted = minted + 1 where slug = pick returning minted into minted_now;
      insert into public.card_copies (card_slug, serial, owner_id, obtained_via)
        values (pick, minted_now, uid, 'pack')
        returning id into new_copy;
      pulled := pulled || new_copy;

      copy_id := new_copy;
      card_slug := pick;
      serial := minted_now;
      return next;
    end loop;
  end loop;

  insert into public.pack_openings (user_id, pack_id, copies) values (uid, p_pack, pulled);
end;
$$;
