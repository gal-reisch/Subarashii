import type { SupabaseClient } from "@supabase/supabase-js";
import { matchIngredientNutrition } from "./nutrition/match";
import type { ParsedRecipe } from "./types";

// Resolve the single household id, creating it on first use if it doesn't
// exist yet. Works with both the service client (bypasses RLS, returns/creates
// the one row) and a user client (RLS returns only their row).
//
// Historically the household row was bootstrapped by a `handle_new_user()`
// Postgres trigger that fired on the first Supabase Auth signup (see
// supabase/migrations/0001_init.sql). Task #24 replaced per-user Supabase
// Auth with a single shared PIN, so that trigger never fires anymore — this
// function now does the same bootstrap explicitly instead, so a brand-new
// database still "just works" the first time a recipe is saved.
export async function getHouseholdId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data } = await supabase
    .from("household")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (data?.id) return data.id;

  const { data: created, error } = await supabase
    .from("household")
    .insert({ name: "Home" })
    .select("id")
    .single();
  if (error || !created) return null;
  return created.id;
}

// Persist a parsed recipe and its ingredients/steps. Returns the new recipe id.
export async function saveParsedRecipe(
  supabase: SupabaseClient,
  householdId: string,
  parsed: ParsedRecipe,
  createdBy: string | null,
): Promise<{ id: string }> {
  const { data: recipe, error } = await supabase
    .from("recipe")
    .insert({
      household_id: householdId,
      title: parsed.title,
      source_url: parsed.source_url,
      source_type: parsed.source_type,
      cover_image_url: parsed.cover_image_url,
      servings: parsed.servings,
      total_time_min: parsed.total_time_min,
      cuisine: parsed.cuisine,
      primary_language: parsed.primary_language,
      needs_review: parsed.needs_review,
      raw_capture: parsed.raw_capture,
      created_by: createdBy,
      status: "to_try",
    })
    .select("id")
    .single();

  if (error || !recipe) {
    throw new Error(error?.message ?? "Failed to create recipe");
  }

  await insertRecipeContent(supabase, recipe.id, parsed);
  return { id: recipe.id };
}

// Write a parsed recipe's ingredients and steps against an existing recipe id.
// Split out of `saveParsedRecipe` so the re-import path (which updates a row
// rather than creating one) gets identical nutrition matching and ordering
// instead of a second, subtly-different copy of this logic.
async function insertRecipeContent(
  supabase: SupabaseClient,
  recipeId: string,
  parsed: ParsedRecipe,
): Promise<void> {
  if (parsed.ingredients.length > 0) {
    const { data: insertedIngredients, error: ingErr } = await supabase
      .from("ingredient")
      .insert(
        parsed.ingredients.map((ing, i) => ({
          recipe_id: recipeId,
          position: i,
          raw_text: ing.raw_text,
          language: ing.language,
        })),
      )
      .select("id, raw_text, language");
    if (ingErr) throw new Error(ingErr.message);

    // Nutrition matching (task #20): real database match first (Tzameret/
    // USDA), LLM estimate as a flagged fallback. Runs synchronously as part
    // of the save (adds latency, but keeps nutrition ready immediately —
    // accepted tradeoff, see plan). Never throws and never blocks the save:
    // a failed or unmatched ingredient just keeps null nutrition columns.
    if (insertedIngredients && insertedIngredients.length > 0) {
      const results = await Promise.allSettled(
        insertedIngredients.map((ing) => matchIngredientNutrition(ing.raw_text, ing.language)),
      );
      await Promise.allSettled(
        results.map((result, i) => {
          if (result.status !== "fulfilled" || !result.value) return Promise.resolve();
          return supabase.from("ingredient").update(result.value).eq("id", insertedIngredients[i].id);
        }),
      );
    }
  }

  if (parsed.steps.length > 0) {
    const { error: stepErr } = await supabase.from("step").insert(
      parsed.steps.map((s, i) => ({
        recipe_id: recipeId,
        position: i,
        text: s.text,
        detected_timer_seconds: s.detected_timer_seconds,
        kind: s.kind,
      })),
    );
    if (stepErr) throw new Error(stepErr.message);
  }
}

/**
 * Re-run the importer against a recipe's original URL and replace its contents.
 *
 * The reason this exists: Instagram serves a login wall instead of the post
 * often enough that a share can land as a title-only stub through no fault of
 * the parser, and improving the parser does nothing for the stubs already
 * sitting in the box. This is the manual second attempt.
 *
 * Two things it deliberately will NOT do:
 *   - Touch the row at all if the re-parse comes back empty. A failed retry
 *     leaves the recipe exactly as it was rather than overwriting a partial
 *     recipe with nothing.
 *   - Blank out a field the user has since filled in by hand. Title, cover
 *     image, servings, time and cuisine are only taken from the parse when it
 *     actually found one, so hand-corrections survive a retry.
 */
export async function reimportRecipe(
  supabase: SupabaseClient,
  recipeId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: recipe } = await supabase
    .from("recipe")
    .select("id,title,source_url,cover_image_url,servings,total_time_min,cuisine")
    .eq("id", recipeId)
    .maybeSingle();

  if (!recipe) return { ok: false, message: "That recipe isn't here anymore." };
  if (!recipe.source_url) {
    return { ok: false, message: "There's no link to read this one from." };
  }

  // Imported lazily: this module is pulled into pages that only ever read
  // recipes, and the parser drags in cheerio plus the whole LLM client.
  const { parseFromUrl } = await import("./parser");
  const parsed = await parseFromUrl(recipe.source_url);

  if (parsed.ingredients.length === 0 && parsed.steps.length === 0) {
    return {
      ok: false,
      message: "Still can't read that one — the site wasn't sharing it. Worth another go in a minute.",
    };
  }

  // Children go first: `ingredient` and `step` have no unique key to upsert
  // against, and position ordering only makes sense for a complete set.
  const { error: delErr } = await supabase.from("ingredient").delete().eq("recipe_id", recipeId);
  if (delErr) return { ok: false, message: "Couldn't refresh that one. Try again?" };
  const { error: delStepErr } = await supabase.from("step").delete().eq("recipe_id", recipeId);
  if (delStepErr) return { ok: false, message: "Couldn't refresh that one. Try again?" };

  const { error: updErr } = await supabase
    .from("recipe")
    .update({
      // `??` not `||` on the title: "Saved recipe" is what the parser returns
      // when it found no title, and that shouldn't clobber a better existing
      // one — but `cleanTitle` already turned junk into null upstream, so a
      // non-default title here is genuinely better than what's stored.
      title: parsed.title === "Saved recipe" ? recipe.title : parsed.title,
      cover_image_url: parsed.cover_image_url ?? recipe.cover_image_url,
      servings: parsed.servings ?? recipe.servings,
      total_time_min: parsed.total_time_min ?? recipe.total_time_min,
      cuisine: parsed.cuisine ?? recipe.cuisine,
      primary_language: parsed.primary_language,
      needs_review: parsed.needs_review,
      raw_capture: parsed.raw_capture,
    })
    .eq("id", recipeId);
  if (updErr) return { ok: false, message: "Couldn't refresh that one. Try again?" };

  await insertRecipeContent(supabase, recipeId, parsed);
  return { ok: true };
}
