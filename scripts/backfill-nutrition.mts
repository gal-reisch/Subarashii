// One-off (re-runnable) backfill: resolves nutrition for every ingredient row
// that doesn't have any yet.
//
// New recipes get their nutrition resolved during the save itself (see
// `saveParsedRecipe` in src/lib/recipes.ts), but every recipe saved *before*
// task #20 shipped has all-null nutrition columns — which is why their cards
// fell back to showing cook time instead of calories. Unlike the step-kind
// and paren-merge repairs, this one can't be derived at render time: it needs
// live Tzameret/USDA/Gemini lookups, so it has to be written to the table.
//
// Usage: npx tsx scripts/backfill-nutrition.mts [--force]
//
//   --force  re-resolve ingredients that already have nutrition (use after
//            improving the matching heuristics; otherwise they're skipped).
//
// Imports the real `matchIngredientNutrition` rather than reimplementing it,
// so this can't drift from what the app does at save time.
import { readFileSync } from "node:fs";

// Tiny inline .env parser — same approach as scripts/verify-nutrition.mts,
// avoids a dotenv dependency for a script that runs a handful of times.
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] = m[2];
}

const { createClient } = await import("@supabase/supabase-js");
const { matchIngredientNutrition } = await import("../src/lib/nutrition/match");

const force = process.argv.includes("--force");

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const { data: ingredients, error } = await admin
  .from("ingredient")
  .select("id,raw_text,language,calories,recipe_id")
  .order("recipe_id")
  .order("position");

if (error) {
  console.error("Failed to fetch ingredients:", error.message);
  process.exit(1);
}

const todo = force ? ingredients : ingredients.filter((i) => i.calories == null);
console.log(
  `${ingredients.length} ingredient(s) total, ${todo.length} to resolve${force ? " (--force)" : ""}.`,
);

// Sequential on purpose, in repeated passes.
//
// `matchIngredientNutrition` deliberately swallows every error and returns
// null, so from out here a Gemini 429 is indistinguishable from "this line
// genuinely has no nutrition" (a section header like "For the sauce:", or
// plain water). The free tier's per-minute quota runs out partway through a
// backfill of any size, and on the first run that silently left two thirds
// of one recipe unresolved.
//
// Rather than plumb error types back through the matcher — which would
// complicate the code path the app actually uses at save time for the sake
// of a maintenance script — just retry the leftovers after the quota window
// rolls over. Anything still unresolved after a few passes is almost
// certainly a genuine non-food line.
const PASSES = 4;
const PASS_PAUSE_MS = 65_000; // Gemini's free-tier quota is per minute.

let pending = todo;
let resolved = 0;
for (let pass = 1; pass <= PASSES && pending.length > 0; pass++) {
  if (pass > 1) {
    console.log(`\nPass ${pass}: retrying ${pending.length} unresolved after a quota pause…`);
    await new Promise((r) => setTimeout(r, PASS_PAUSE_MS));
  }
  const stillPending: typeof pending = [];
  for (const ing of pending) {
    const result = await matchIngredientNutrition(ing.raw_text, ing.language);
    if (!result) {
      stillPending.push(ing);
      continue;
    }
    const { error: updateErr } = await admin.from("ingredient").update(result).eq("id", ing.id);
    if (updateErr) {
      console.error(`  ! ${ing.raw_text.slice(0, 40)}: ${updateErr.message}`);
      stillPending.push(ing);
      continue;
    }
    resolved++;
    console.log(
      `  ✓ ${ing.raw_text.slice(0, 42).padEnd(42)} ${String(Math.round(result.calories ?? 0)).padStart(6)} kcal  (${result.fdc_source}${result.is_estimated ? ", est" : ""})`,
    );
  }
  pending = stillPending;
}

for (const ing of pending) console.log(`  ✗ ${ing.raw_text.slice(0, 50)}`);
console.log(`\nDone. ${resolved} resolved, ${pending.length} unresolved.`);
