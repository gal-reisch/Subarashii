-- Favorites (task #24 nav restructure) — the Figma `Nav Bar` component has a
-- dedicated "Favorites" tab (heart), so recipes need a household-shared
-- favorite flag distinct from the existing `status` (to_try/made) and from
-- collection membership (shelves).
--
-- Additive and non-destructive: a single boolean column with a safe default.
-- No new RLS policy is required — the existing `recipe_rw` policy is `for all`
-- (select/insert/update/delete) scoped to the household, so reading and
-- toggling this column is already covered.

alter table public.recipe
  add column if not exists is_favorite boolean not null default false;

-- Partial index: the /favorites view only ever queries the favorited subset,
-- which is expected to stay small relative to the whole box.
create index if not exists recipe_favorite_idx
  on public.recipe (household_id, created_at desc)
  where is_favorite;
