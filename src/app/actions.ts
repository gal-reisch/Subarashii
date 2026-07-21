"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { detectLang, type Lang } from "@/lib/lang";
import { parseInput } from "@/lib/parser";
import { classifyStepKind } from "@/lib/parser/stepKind";
import { getHouseholdId, saveParsedRecipe } from "@/lib/recipes";
import { createServiceClient } from "@/lib/supabase/service";
import { SESSION_COOKIE } from "@/lib/session";
import { detectTimerSeconds } from "@/lib/timers";
import type { ParsedRecipe } from "@/lib/types";

function majorityLang(texts: string[]): Lang | null {
  if (texts.length === 0) return null;
  const he = texts.filter((t) => detectLang(t) === "he").length;
  return he >= texts.length / 2 && he > 0 ? "he" : "en";
}

// Save a recipe from a pasted/shared URL.
export async function addFromUrlAction(formData: FormData) {
  const url = String(formData.get("url") ?? "").trim();
  if (!url) redirect("/add?error=empty");

  // No per-user identity anymore (task #24 PIN-auth migration) — the
  // service-role client bypasses RLS entirely and `createdBy` is nullable,
  // same pattern already used by /api/ingest.
  const supabase = createServiceClient();
  const parsed = await parseInput({ url });
  const householdId = await getHouseholdId(supabase);
  if (!householdId) throw new Error("No household found");

  const { id } = await saveParsedRecipe(supabase, householdId, parsed, null);
  revalidatePath("/");
  redirect(`/recipe/${id}`);
}

// Save a hand-entered recipe.
export async function addManualAction(formData: FormData) {
  const supabase = createServiceClient();

  const title = String(formData.get("title") ?? "").trim() || "Untitled recipe";
  const servingsRaw = String(formData.get("servings") ?? "").trim();
  const servingsNum = parseInt(servingsRaw, 10);
  const servings = servingsRaw && !Number.isNaN(servingsNum) ? servingsNum : null;
  const coverUrl = String(formData.get("cover_image_url") ?? "").trim() || null;

  const ingredients = String(formData.get("ingredients") ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw_text) => ({ raw_text, language: detectLang(raw_text) }));

  const steps = String(formData.get("steps") ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((text) => ({
      text,
      detected_timer_seconds: detectTimerSeconds(text),
      kind: classifyStepKind(text),
    }));

  const parsed: ParsedRecipe = {
    title,
    source_url: null,
    source_type: "manual",
    cover_image_url: coverUrl,
    servings,
    total_time_min: null,
    cuisine: null,
    primary_language: majorityLang([
      ...ingredients.map((i) => i.raw_text),
      ...steps.map((s) => s.text),
    ]),
    ingredients,
    steps,
    needs_review: false,
    raw_capture: null,
  };

  const householdId = await getHouseholdId(supabase);
  if (!householdId) throw new Error("No household found");

  const { id } = await saveParsedRecipe(supabase, householdId, parsed, null);
  revalidatePath("/");
  redirect(`/recipe/${id}`);
}

// Toggle a recipe's household-shared favorite flag (task #24 nav restructure —
// backs the Figma "Favorites" tab). Rendered as a small <form> on the recipe
// detail page so it works with a plain submit, no client JS. Requires the
// `is_favorite` column from migration 0005_favorite.sql.
export async function toggleFavoriteAction(formData: FormData) {
  const recipeId = String(formData.get("recipe_id") ?? "");
  const isFavorite = formData.get("is_favorite") === "true";
  if (!recipeId) return;

  const supabase = createServiceClient();
  await supabase.from("recipe").update({ is_favorite: !isFavorite }).eq("id", recipeId);
  revalidatePath(`/recipe/${recipeId}`);
  revalidatePath("/favorites");
  revalidatePath("/");
}

export async function signOutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
