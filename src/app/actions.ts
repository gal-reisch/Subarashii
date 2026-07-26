"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { detectLang, type Lang } from "@/lib/lang";
import { heuristicFromText, parseInput } from "@/lib/parser";
import { extractRecipeFromImages } from "@/lib/parser/llm";
import { classifyStepKind } from "@/lib/parser/stepKind";
import { getHouseholdId, saveParsedRecipe } from "@/lib/recipes";
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
