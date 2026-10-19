create table public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now(),
  source text,
  user_agent text,
  constraint waitlist_signups_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

alter table public.waitlist_signups enable row level security;

create policy "Allow public insert"
  on public.waitlist_signups
  for insert
  to anon
  with check (true);
