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

  if (parsed.ingredients.length > 0) {
    const { data: insertedIngredients, error: ingErr } = await supabase
      .from("ingredient")
      .insert(
        parsed.ingredients.map((ing, i) => ({
          recipe_id: recipe.id,
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
        recipe_id: recipe.id,
        position: i,
        text: s.text,
        detected_timer_seconds: s.detected_timer_seconds,
        kind: s.kind,
      })),
    );
    if (stepErr) throw new Error(stepErr.message);
  }

  return { id: recipe.id };
}
