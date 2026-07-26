"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { detectLang, type Lang } from "@/lib/lang";
import { heuristicFromText, parseInput } from "@/lib/parser";
import { extractRecipeFromImages } from "@/lib/parser/llm";
import { classifyStepKind } from "@/lib/parser/stepKind";
import { getHouseholdId, reimportRecipe, saveParsedRecipe } from "@/lib/recipes";
import { createServiceClient } from "@/lib/supabase/service";
import { SESSION_COOKIE } from "@/lib/session";
import { detectTimerSeconds } from "@/lib/timers";
import type { ParsedRecipe } from "@/lib/types";

// Mirrors ScreenshotPicker's own cap — the client won't send more, but a
// Server Action is a public POST endpoint and can't rely on that.
const MAX_SCREENSHOTS = 8;

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

// Save a recipe read out of one or more screenshots.
//
// The images arrive already downscaled to ~1600px JPEG by ScreenshotPicker,
// as base64 in repeated `image` fields, in the order the user added them —
// which matters, since a recipe split across three shots only reads correctly
// in sequence.
//
// Unlike the URL and manual paths this one can genuinely come back empty (no
// GEMINI_API_KEY configured, a blurry photo, a screenshot of something that
// isn't a recipe). Rather than saving a blank recipe the user then has to
// find and delete, it bounces back to /add with an error.
export async function addFromScreenshotsAction(formData: FormData) {
  const images = formData
    .getAll("image")
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .slice(0, MAX_SCREENSHOTS)
    .map((data) => ({ mimeType: "image/jpeg", data }));

  if (images.length === 0) redirect("/add?tab=photo&error=no-images");

  const llm = await extractRecipeFromImages(images);
  if (!llm) redirect("/add?tab=photo&error=unreadable");

  // Reuse the free-text draft shape (source_type, empty defaults) and let the
  // extraction fill it in — same merge the caption path uses, so a screenshot
  // import and an Instagram import produce identically-shaped rows.
  const base = heuristicFromText("", "screenshot");
  const parsed: ParsedRecipe = {
    ...base,
    title: llm.title?.trim() || "Saved recipe",
    servings: llm.servings,
    total_time_min: llm.total_time_min,
    cuisine: llm.cuisine,
    ingredients: llm.ingredients.map((raw_text) => ({
      raw_text,
      language: detectLang(raw_text),
    })),
    steps: llm.steps.map((text) => ({
      text,
      detected_timer_seconds: detectTimerSeconds(text),
      kind: classifyStepKind(text),
    })),
    // Screenshots aren't stored anywhere (no storage bucket in this app), so
    // there's nothing to point a cover image at and nothing to re-read later.
    cover_image_url: null,
    raw_capture: null,
  };
  parsed.primary_language = majorityLang([
    ...parsed.ingredients.map((i) => i.raw_text),
    ...parsed.steps.map((s) => s.text),
  ]);
  parsed.needs_review = parsed.ingredients.length === 0 || parsed.steps.length === 0;

  const supabase = createServiceClient();
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
  // Unwraps a pasted Google-Images result link into the actual image URL, and
  // drops anything that isn't http(s). See lib/imageUrl.ts.
  const coverUrl = normalizeImageUrl(String(formData.get("cover_image_url") ?? ""));

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
    author: null,
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

// Set (or correct) how many servings a recipe makes.
//
// Not cosmetic: `computeNutritionTotals` divides by this number, so until
// it's known the nutrition panel can only show whole-recipe totals. Plenty
// of sources — Instagram captions especially — never state a yield, and the
// extractor is instructed never to invent one, so this is the manual way to
// turn "2,104 kcal for the tray" into "351 kcal a portion".
//
// Clamped to 1-100. A zero would divide by zero; the upper bound is just a
// guard on a public POST endpoint. Submitting an empty value clears it back
// to unknown, which is the honest state for a recipe nobody has portioned.
export async function setServingsAction(formData: FormData) {
  const recipeId = String(formData.get("recipe_id") ?? "");
  if (!recipeId) return;

  const raw = String(formData.get("servings") ?? "").trim();
  const parsedNum = parseInt(raw, 10);
  const servings =
    raw && !Number.isNaN(parsedNum) && parsedNum > 0 ? Math.min(parsedNum, 100) : null;

  const supabase = createServiceClient();
  await supabase.from("recipe").update({ servings }).eq("id", recipeId);

  revalidatePath(`/recipe/${recipeId}`);
  revalidatePath("/");
}

// Read a recipe's source URL again and replace its ingredients/steps with
// whatever comes back.
//
// Instagram hands out a login wall instead of the post often enough that a
// perfectly good reel can land in the box as a bare title with nothing in it —
// the same URL fetched a minute later returns the full caption. Retrying is
// the only thing that helps, and before this the only way to retry was to
// delete the recipe and paste the link again.
//
// Same return-value error model as `deleteRecipeAction`, for the same reason:
// a thrown error in a Server Action doesn't reach app/error.tsx, it just
// silently reloads the page and looks like nothing happened.
export type RetryImportState = { message: string | null; ok: boolean };

export async function retryImportAction(
  _prevState: RetryImportState,
  formData: FormData,
): Promise<RetryImportState> {
  const recipeId = String(formData.get("recipe_id") ?? "");
  if (!recipeId) return { message: "No recipe to re-import.", ok: false };

  const supabase = createServiceClient();
  const result = await reimportRecipe(supabase, recipeId);
  if (!result.ok) return { message: result.message, ok: false };

  revalidatePath(`/recipe/${recipeId}`);
  revalidatePath("/");
  return { message: null, ok: true };
}

// Delete a recipe, from either the home-page card's small × or the detail
// page's full-width Delete button. Both go through the confirm dialog in
// components/DeleteRecipe.tsx first — this action itself is unguarded, since
// a Server Action is a public POST endpoint and a second confirmation here
// would just be theater.
//
// Only the `recipe` row is deleted: ingredient, step, recipe_collection and
// cook_log all declare `on delete cascade` on their recipe_id foreign key
// (supabase/migrations/0001_init.sql), so the children go with it and there's
// nothing to clean up by hand.
export type DeleteRecipeState = { message: string | null };

export async function deleteRecipeAction(
  _prevState: DeleteRecipeState,
  formData: FormData,
): Promise<DeleteRecipeState> {
  const recipeId = String(formData.get("recipe_id") ?? "");
  if (!recipeId) return { message: "No recipe to delete." };

  const supabase = createServiceClient();
  const { error } = await supabase.from("recipe").delete().eq("id", recipeId);
  // The result used to be discarded, so a delete that failed (dropped
  // connection, bad id, RLS) still fell through to the redirect and the user
  // landed back on a box that quietly still contained the recipe.
  //
  // Returned rather than thrown, per this version's guidance: "avoid using
  // try/catch blocks and throw errors. Instead, model expected errors as
  // return values" (node_modules/next/dist/docs/01-app/01-getting-started/
  // 10-error-handling.md). A throw here doesn't reach app/error.tsx anyway —
  // it triggers a silent full-page reload back to the box, which is exactly
  // the "nothing happened" behaviour we're trying to kill. Returning lets the
  // dialog say what went wrong and offer another go.
  if (error) return { message: "Couldn't delete that one. Try again?" };

  revalidatePath("/");
  revalidatePath("/favorites");
  revalidatePath("/collections");
  // Always land on the box. Deleting from a card could technically stay put,
  // but the detail page for a just-deleted recipe would 404, so both entry
  // points share the same destination.
  redirect("/");
}

export async function signOutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
