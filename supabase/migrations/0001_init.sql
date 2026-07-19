-- Subarashii — initial schema (Phase 1)
-- One shared "household" workspace. Every signed-in user is attached to it and
-- sees the same recipes. Row Level Security scopes all data to the household.

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

create table if not exists public.household (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default 'Home',
  created_at timestamptz not null default now()
);

create table if not exists public.profile (
  id           uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.household (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

create table if not exists public.recipe (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.household (id) on delete cascade,
  title          text not null default 'Untitled recipe',
  source_url     text,
  source_type    text not null default 'other'
                   check (source_type in ('blog','instagram','tiktok','screenshot','manual','other')),
  cover_image_url text,
  servings       int,
  total_time_min int,
  cuisine        text,
  primary_language text check (primary_language in ('he','en')),
  status         text not null default 'to_try' check (status in ('to_try','made')),
  needs_review   boolean not null default false,
  notes          text,
  raw_capture    text, -- raw url/text kept so a failed parse never loses data
  created_by     uuid references auth.users (id),
  created_at     timestamptz not null default now()
);
create index if not exists recipe_household_idx on public.recipe (household_id, created_at desc);

create table if not exists public.ingredient (
  id             uuid primary key default gen_random_uuid(),
  recipe_id      uuid not null references public.recipe (id) on delete cascade,
  position       int not null default 0,
  raw_text       text not null,
  quantity       numeric,
  unit           text,
  name_normalized text,
  language       text check (language in ('he','en')),
  grams_resolved numeric,
  fdc_source     text check (fdc_source in ('tzameret','usda','none')),
  calories       numeric,
  protein_g      numeric,
  carbs_g        numeric,
  fat_g          numeric,
  fiber_g        numeric
);
create index if not exists ingredient_recipe_idx on public.ingredient (recipe_id, position);

create table if not exists public.step (
  id                     uuid primary key default gen_random_uuid(),
  recipe_id              uuid not null references public.recipe (id) on delete cascade,
  position               int not null,
  text                   text not null,
  detected_timer_seconds int
);
create index if not exists step_recipe_idx on public.step (recipe_id, position);

create table if not exists public.collection (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  name         text not null,
  is_auto      boolean not null default false,
  sort_order   int not null default 0,
  cover_style  text,
  created_at   timestamptz not null default now()
);

create table if not exists public.recipe_collection (
  recipe_id     uuid not null references public.recipe (id) on delete cascade,
  collection_id uuid not null references public.collection (id) on delete cascade,
  sort_order    int not null default 0,
  primary key (recipe_id, collection_id)
);

create table if not exists public.cook_log (
  id        uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipe (id) on delete cascade,
  cooked_at timestamptz not null default now(),
  rating    int check (rating between 1 and 5),
  note      text
);
create index if not exists cook_log_recipe_idx on public.cook_log (recipe_id, cooked_at desc);

create table if not exists public.timer_preset (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.household (id) on delete cascade,
  label          text not null,
  default_seconds int not null default 300,
  icon           text,
  sort_order     int not null default 0
);

create table if not exists public.pantry_item (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  name         text not null,
  language     text check (language in ('he','en')),
  created_at   timestamptz not null default now()
);

create table if not exists public.shopping_item (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  name         text not null,
  recipe_id    uuid references public.recipe (id) on delete set null,
  checked      boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Helper: the household of the currently signed-in user
-- ----------------------------------------------------------------------------

create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.profile where id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- Auto-provision: attach every new auth user to the single household
-- and seed default timer presets the first time.
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hid uuid;
begin
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

alter table public.household         enable row level security;
alter table public.profile           enable row level security;
alter table public.recipe            enable row level security;
alter table public.ingredient        enable row level security;
alter table public.step              enable row level security;
alter table public.collection        enable row level security;
alter table public.recipe_collection enable row level security;
alter table public.cook_log          enable row level security;
alter table public.timer_preset      enable row level security;
alter table public.pantry_item       enable row level security;
alter table public.shopping_item     enable row level security;

-- household: members can see/rename their own household
create policy household_rw on public.household
  for all using (id = public.current_household_id())
  with check (id = public.current_household_id());

-- profile: a user sees profiles in their household; can edit only their own
create policy profile_select on public.profile
  for select using (household_id = public.current_household_id());
create policy profile_update_self on public.profile
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Helper predicate for household-scoped tables is inlined per policy below.

create policy recipe_rw on public.recipe
  for all using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy collection_rw on public.collection
  for all using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy timer_preset_rw on public.timer_preset
  for all using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy pantry_rw on public.pantry_item
  for all using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy shopping_rw on public.shopping_item
  for all using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- Child tables inherit scope through their parent recipe.
create policy ingredient_rw on public.ingredient
  for all using (
    exists (select 1 from public.recipe r
            where r.id = ingredient.recipe_id
              and r.household_id = public.current_household_id())
  )
  with check (
    exists (select 1 from public.recipe r
            where r.id = ingredient.recipe_id
              and r.household_id = public.current_household_id())
  );

create policy step_rw on public.step
  for all using (
    exists (select 1 from public.recipe r
            where r.id = step.recipe_id
              and r.household_id = public.current_household_id())
  )
  with check (
    exists (select 1 from public.recipe r
            where r.id = step.recipe_id
              and r.household_id = public.current_household_id())
  );

create policy recipe_collection_rw on public.recipe_collection
  for all using (
    exists (select 1 from public.recipe r
            where r.id = recipe_collection.recipe_id
              and r.household_id = public.current_household_id())
  )
  with check (
    exists (select 1 from public.recipe r
            where r.id = recipe_collection.recipe_id
              and r.household_id = public.current_household_id())
  );

create policy cook_log_rw on public.cook_log
  for all using (
    exists (select 1 from public.recipe r
            where r.id = cook_log.recipe_id
              and r.household_id = public.current_household_id())
  )
  with check (
    exists (select 1 from public.recipe r
            where r.id = cook_log.recipe_id
              and r.household_id = public.current_household_id())
  );
