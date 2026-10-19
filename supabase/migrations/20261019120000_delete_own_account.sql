-- Lets a signed-in user delete their own account (GDPR), along with their
-- waitlist entry. Profiles go with auth.users via ON DELETE CASCADE.
create function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from public.waitlist_signups where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
