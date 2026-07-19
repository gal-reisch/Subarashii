-- ----------------------------------------------------------------------------
-- Restrict sign-up/sign-in to an explicit allow-list.
--
-- Subarashii is a private, two-person household app. Once deployed to a
-- public URL, anyone who finds the login page could otherwise type their own
-- email, receive a real magic link in their own inbox, and get auto-attached
-- to the household with full read/write access (see handle_new_user() below).
-- This closes that gap at the database layer, so it can't be bypassed by
-- calling the Supabase Auth API directly with the public anon key.
-- ----------------------------------------------------------------------------

create table if not exists public.allowed_email (
  email text primary key
);

-- No RLS policies are added on purpose: this table has RLS enabled with a
-- default-deny posture, so no client (authenticated or not) can read or write
-- it directly. Only the security-definer trigger function below touches it.
alter table public.allowed_email enable row level security;

insert into public.allowed_email (email) values
  ('zerobygal@gmail.com'),
  ('galreisch@gmail.com'),
  ('arielashahnuk@gmail.com'),
  ('ellashahnuk@gmail.com')
on conflict (email) do nothing;

-- Re-define the new-user trigger function to reject anyone not on the list.
-- Raising an exception here aborts the whole transaction, so the INSERT into
-- auth.users itself fails — the account is never created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  if not exists (
    select 1 from public.allowed_email where email = lower(new.email)
  ) then
    raise exception 'Subarashii is a private app — % is not invited.', new.email;
  end if;

  select id into hid from public.household order by created_at asc limit 1;
  if hid is null then
    insert into public.household (name) values ('Home') returning id into hid;
  end if;

  insert into public.profile (id, household_id, display_name)
  values (
    new.id,
    hid,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );

  if not exists (select 1 from public.timer_preset t where t.household_id = hid) then
    insert into public.timer_preset (household_id, label, default_seconds, icon, sort_order)
    values
      (hid, 'Oven',  600, 'oven',  1),
      (hid, 'Stove', 300, 'stove', 2),
      (hid, 'Boil',  600, 'pot',   3),
      (hid, 'Rest',  300, 'timer', 4);
  end if;

  return new;
end;
$$;
