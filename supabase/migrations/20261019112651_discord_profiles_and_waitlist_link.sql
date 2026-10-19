alter table public.waitlist_signups
  add column user_id uuid references auth.users (id) on delete set null;

create unique index waitlist_signups_user_id_key
  on public.waitlist_signups (user_id)
  where user_id is not null;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  discord_id text,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := new.raw_user_meta_data;
begin
  insert into public.profiles (id, discord_id, display_name, avatar_url)
  values (
    new.id,
    meta ->> 'provider_id',
    coalesce(meta -> 'custom_claims' ->> 'global_name', meta ->> 'full_name', meta ->> 'name'),
    meta ->> 'avatar_url'
  );

  if new.email is not null then
    insert into public.waitlist_signups (email, source, user_id)
    values (lower(new.email), 'discord_signup', new.id)
    on conflict (email) do update
      set user_id = excluded.user_id
      where public.waitlist_signups.user_id is null;
  end if;

  return new;
end;
$$;

create function public.handle_user_metadata_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := new.raw_user_meta_data;
begin
  update public.profiles
  set
    display_name = coalesce(meta -> 'custom_claims' ->> 'global_name', meta ->> 'full_name', meta ->> 'name'),
    avatar_url = meta ->> 'avatar_url',
    updated_at = now()
  where id = new.id;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_metadata_update() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger on_auth_user_metadata_updated
  after update of raw_user_meta_data on auth.users
  for each row
  when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
  execute function public.handle_user_metadata_update();
