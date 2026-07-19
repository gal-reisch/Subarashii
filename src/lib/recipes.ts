import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedRecipe } from "./types";

// Resolve the single household id. Works with both the service client (bypasses
// RLS, returns the one row) and a user client (RLS returns only their row).
export async function getHouseholdId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const { data } = await supabase
    .from("household")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
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
    const { error: ingErr } = await supabase.from("ingredient").insert(
      parsed.ingredients.map((ing, i) => ({
        recipe_id: recipe.id,
        position: i,
        raw_text: ing.raw_text,
        language: ing.language,
      })),
    );
    if (ingErr) throw new Error(ingErr.message);
  }

  if (parsed.steps.length > 0) {
    const { error: stepErr } = await supabase.from("step").insert(
      parsed.steps.map((s, i) => ({
        recipe_id: recipe.id,
        position: i,
        text: s.text,
        detected_timer_seconds: s.detected_timer_seconds,
      })),
    );
    if (stepErr) throw new Error(stepErr.message);
  }

  return { id: recipe.id };
}
