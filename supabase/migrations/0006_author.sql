-- Recipe author/chef attribution.
--
-- The Figma card design gives the author its own line under the title — the
-- hierarchy there is category → dish → who made it — and the app was dropping
-- that entirely. It's the one piece of provenance that survives being pasted
-- around: an Instagram reel is "that thing @chef posted", and a blog recipe
-- is worth crediting to whoever wrote it.
--
-- Nullable with no default, because most captures genuinely won't state one
-- and an empty string masquerading as an answer is worse than a null the card
-- can simply not render.
--
-- Additive and non-destructive. No new RLS policy needed: the existing
-- `recipe_rw` policy is `for all`, scoped to the household, so this column is
-- already covered. No index — the author is displayed, never filtered on.

alter table public.recipe
  add column if not exists author text;
