create policy "Signed-in users can join the waitlist"
  on public.waitlist_signups
  for insert
  to authenticated
  with check (user_id is null or user_id = (select auth.uid()));

create policy "Users read their own waitlist entry"
  on public.waitlist_signups
  for select
  to authenticated
  using (user_id = (select auth.uid()));
