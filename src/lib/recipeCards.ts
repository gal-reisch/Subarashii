import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeImageUrl } from "./imageUrl";
import { caloriesPer100g, computeNutritionTotals, getNutritionFlags } from "./nutritionCalc";
import { isUndefinedColumn } from "./pgErrors";

// The one query behind every recipe-card surface (the box, Favorites).
//
// Both pages used to carry their own copy of the column list, the row
// interface and the row → card mapping. They drifted by exactly the amount
// you'd expect: adding a field to a card meant remembering two files, and
// forgetting the second showed up as a card that rendered fine on one page
// and blank on the other. One definition, two callers.

/** What a card actually renders. Everything here is derived server-side so
 *  the client component stays presentational. */
export interface CardRecipe {
  id: string;
  title: string;
  cover_image_url: string | null;
  source_type: string;
  needs_review: boolean;
  total_time_min: number | null;
  cuisine: string | null;
  /** Who wrote/cooked it, when the source said. Null for most captures. */
  author: string | null;
  /** Calories per 100g of finished dish, or null when the recipe's weights
   *  are too patchy to say. See `caloriesPer100g` for why 100g rather than a
   *  serving. */
  caloriesPer100g: number | null;
  /** Whole-recipe or per-serving calories — the fallback stat for recipes
   *  with nutrition data but not enough resolved weights for a density. */
  calories: number | null;
  caloriesPerServing: boolean;
  /** "High Protein"/"High Sugar"/etc, same classification as the recipe
   *  detail page's NutritionChips. */
  nutritionFlags: string[];
}

const INGREDIENT_COLS =
  "calories,protein_g,carbs_g,fat_g,fiber_g,sugar_g,is_estimated,grams_resolved";
const RECIPE_COLS =
  "id,title,cover_image_url,source_type,needs_review,total_time_min,cuisine,servings";

const columns = (withAuthor: boolean) =>
  `${RECIPE_COLS}${withAuthor ? ",author" : ""},ingredient(${INGREDIENT_COLS})`;

interface RecipeRow {
  id: string;
  title: string;
  cover_image_url: string | null;
  source_type: string;
  needs_review: boolean;
  total_time_min: number | null;
  cuisine: string | null;
  servings: number | null;
  author?: string | null;
  ingredient:
    | {
        calories: number | null;
        protein_g: number | null;
        carbs_g: number | null;
        fat_g: number | null;
        fiber_g: number | null;
        sugar_g: number | null;
        is_estimated: boolean;
        grams_resolved: number | null;
      }[]
    | null;
}

export interface RecipeCardsResult {
  recipes: CardRecipe[];
  /** True when the query failed outright — in practice, a column the app
   *  expects isn't in the database yet. Callers decide whether that's fatal
   *  (Favorites is nothing without `is_favorite`) or not. */
  failed: boolean;
}

export async function fetchRecipeCards(
  supabase: SupabaseClient,
  { favoritesOnly = false }: { favoritesOnly?: boolean } = {},
): Promise<RecipeCardsResult> {
  const run = (withAuthor: boolean) => {
    const q = supabase.from("recipe").select(columns(withAuthor));
    return (favoritesOnly ? q.eq("is_favorite", true) : q).order("created_at", {
      ascending: false,
    });
  };

  let { data, error } = await run(true);
  if (isUndefinedColumn(error)) {
    // `author` only exists once migration 0006 has been applied, and asking
    // for a column that isn't there fails the whole select. A missing line of
    // attribution shouldn't blank out the entire box, so drop it and retry —
    // the card already renders fine without an author.
    ({ data, error } = await run(false));
  }
  if (error) return { recipes: [], failed: true };

  const rows = (data ?? []) as unknown as RecipeRow[];
  return { recipes: rows.map(toCardRecipe), failed: false };
}

function toCardRecipe(r: RecipeRow): CardRecipe {
  const ingredients = r.ingredient ?? [];
  const totals = computeNutritionTotals(ingredients, r.servings);
  return {
    id: r.id,
    title: r.title,
    // Normalized at render time, not just at save time, so recipes stored
    // with a Google-Images result link (which renders as a broken-image
    // icon) fix themselves without being re-saved. See lib/imageUrl.ts.
    cover_image_url: normalizeImageUrl(r.cover_image_url),
    source_type: r.source_type,
    needs_review: r.needs_review,
    total_time_min: r.total_time_min,
    cuisine: r.cuisine,
    author: r.author?.trim() || null,
    caloriesPer100g: caloriesPer100g(ingredients),
    calories: totals?.calories ?? null,
    caloriesPerServing: totals?.perServing ?? false,
    nutritionFlags: getNutritionFlags(totals),
  };
}
