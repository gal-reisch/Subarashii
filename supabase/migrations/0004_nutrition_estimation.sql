-- Nutrition chips (task #20): the ingredient table already had per-ingredient
-- calories/protein_g/carbs_g/fat_g/fiber_g + fdc_source ('tzameret' | 'usda' |
-- 'none') from Phase 1, but two things it needs were missing:
--   1. sugar_g — "high sugar" was always part of the plan (see task #20) but
--      no column existed for it.
--   2. A way to say "we couldn't match this ingredient to a real food
--      database row, so an LLM estimated it instead" that's distinguishable
--      from fdc_source = 'none' (no match, no value at all). is_estimated
--      lets the UI show a clear "estimated" flag per the standing decision:
--      real database match first, LLM estimate as a labeled fallback, never
--      silently presented as measured fact.

alter table public.ingredient
  add column if not exists sugar_g numeric,
  add column if not exists is_estimated boolean not null default false;

comment on column public.ingredient.is_estimated is
  'true when calories/protein_g/carbs_g/fat_g/fiber_g/sugar_g came from an LLM estimate rather than a Tzameret/USDA database match (fdc_source stays ''none'' in that case — is_estimated is what the UI checks to show the "estimated" flag).';
