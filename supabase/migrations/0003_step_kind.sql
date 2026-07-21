-- ----------------------------------------------------------------------------
-- Classify each recipe step as an actual cooking instruction vs. an author
-- aside that got swept into the instructions block by the source site (a
-- serving suggestion, a note about leftovers, or outright cross-promotion of
-- the author's other posts). schema.org/Recipe has no such distinction, so
-- every line was previously numbered as if it were an equally-required step.
--
-- The classification itself is a best-effort heuristic (see
-- src/lib/parser/stepKind.ts) applied at parse time for new recipes. This
-- migration just adds the column; a one-off backfill script
-- (scripts/reclassify-steps.mjs) applies the same heuristic to steps saved
-- before this existed.
-- ----------------------------------------------------------------------------

alter table public.step
  add column if not exists kind text not null default 'instruction'
    check (kind in ('instruction', 'tip', 'ignored'));
