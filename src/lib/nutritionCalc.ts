// Shared nutrition-totals math + "qualitative flag" classification, used by
// both the recipe detail page's <NutritionChips> and the home page's recipe
// cards (glass badge + calorie footer pill), so the two surfaces never
// disagree about what counts as "High Protein" etc.
//
// NOTE: unrelated to `src/lib/nutrition/` (the ingredient-matching/estimation
// pipeline — Tzameret/USDA lookups, Gemini fallback). This file is pure
// aggregation math over already-resolved per-ingredient values.

export interface NutritionTotals {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  isEstimated: boolean;
  /** True when `servings` was known, so these numbers are per-serving. False
   *  when it wasn't and they're whole-recipe totals instead. Callers must
   *  label the two differently — "2,104 kcal" reads as a per-portion number
   *  and is wildly alarming when it's actually a tray of 30 meatballs. */
  perServing: boolean;
}

interface IngredientNutrition {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  is_estimated: boolean;
  /** Edible weight this row's nutrition describes. Optional because callers
   *  that only need totals don't have to select the column. */
  grams_resolved?: number | null;
}

const NUTRITION_KEYS = ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g"] as const;

// Sums whichever nutrition columns have at least one non-null value across
// the recipe's ingredients, scales to per-serving, and flags the whole
// result as "Estimated" if any contributing ingredient used the LLM
// fallback rather than a Tzameret/USDA match. Returns null when there's no
// nutrition data at all yet — callers should just not render nutrition UI
// rather than showing fabricated zeros.
export function computeNutritionTotals(
  ingredients: IngredientNutrition[],
  servings: number | null,
): NutritionTotals | null {
  const perServing = !!servings && servings > 0;
  const divisor = perServing ? servings : 1;
  const totals: Record<(typeof NUTRITION_KEYS)[number], number | null> = {
    calories: null,
    protein_g: null,
    carbs_g: null,
    fat_g: null,
    fiber_g: null,
    sugar_g: null,
  };
  let anyValue = false;
  let isEstimated = false;

  for (const key of NUTRITION_KEYS) {
    let sum = 0;
    let hasAny = false;
    for (const ing of ingredients) {
      const v = ing[key];
      if (v != null) {
        sum += v;
        hasAny = true;
        if (ing.is_estimated) isEstimated = true;
      }
    }
    if (hasAny) {
      totals[key] = sum / divisor;
      anyValue = true;
    }
  }

  if (!anyValue) return null;
  return { ...totals, isEstimated, perServing };
}

// Rough per-serving thresholds for the qualitative flags. Deliberately
// simple (no RDA %, no age/sex adjustment) — good enough for "does this
// recipe skew toward X" at a glance, not a clinical claim.
//
// These entries used to carry a `bg`/`text` Tailwind class pair each, giving
// every nutrient its own pastel hue. Six competing colors turned out to be
// harder to read than no color at all — you scanned the palette instead of
// the numbers — so the chips are now uniformly pink and the per-nutrient
// classes are gone. See NutritionChips.tsx.
export const NUTRIENT_DEFS: {
  key: (typeof NUTRITION_KEYS)[number];
  label: string;
  unit: string;
  flagLabel?: string;
  threshold?: number;
}[] = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "protein_g", label: "Protein", unit: "g", flagLabel: "High Protein", threshold: 20 },
  { key: "carbs_g", label: "Carbs", unit: "g" },
  { key: "fat_g", label: "Fat", unit: "g", flagLabel: "High Fat", threshold: 20 },
  { key: "fiber_g", label: "Fiber", unit: "g", flagLabel: "High Fiber", threshold: 5 },
  { key: "sugar_g", label: "Sugar", unit: "g", flagLabel: "High Sugar", threshold: 15 },
];

// How much of a recipe's calorie mass has to have a known weight before a
// per-100g figure is worth showing. Density is `calories / grams` over the
// rows where BOTH are known, so a recipe where the butter resolved a weight
// but the cream didn't would report the butter's density as the whole dish's
// — badly wrong, and wrong in a direction nobody can see. Measured by
// calories rather than by ingredient count because a forgotten pinch of salt
// should not veto the figure while a forgotten litre of cream must.
const MIN_DENSITY_COVERAGE = 0.75;

/**
 * Calories per 100g of finished dish, or null when the recipe's weights are
 * too patchy to say.
 *
 * This is the home card's headline stat, and it's there instead of a
 * per-serving figure because a serving is not a unit: "450 kcal per serving"
 * means nothing without knowing whether the recipe's author considered a
 * serving a side dish or a dinner, and they rarely say. 100g is the same
 * 100g in every recipe, so the number is comparable across the whole box.
 *
 * Caveat worth knowing: this is the density of the *ingredients*, so it
 * ignores water driven off by cooking. A stew that simmers for three hours
 * really ends up denser than this says. Correcting for that would mean
 * modelling evaporation per cooking method, which is far more guesswork than
 * the number is worth — the ranking between recipes stays honest either way.
 */
export function caloriesPer100g(ingredients: IngredientNutrition[]): number | null {
  let calWithGrams = 0;
  let grams = 0;
  let calTotal = 0;

  for (const ing of ingredients) {
    if (ing.calories == null) continue;
    calTotal += ing.calories;
    if (ing.grams_resolved != null && ing.grams_resolved > 0) {
      calWithGrams += ing.calories;
      grams += ing.grams_resolved;
    }
  }

  if (grams <= 0 || calTotal <= 0) return null;
  if (calWithGrams / calTotal < MIN_DENSITY_COVERAGE) return null;
  return (calWithGrams / grams) * 100;
}

// Which qualitative flags a set of totals trips, in the same fixed order as
// NUTRIENT_DEFS (protein, fat, fiber, sugar) — used both to render the
// detail page's flag pills and to pick a single flag for the home card's
// glass badge.
//
// Returns nothing when the totals aren't per-serving: every threshold above
// is a per-portion figure, so a whole tray of anything trips all four at
// once and the badge stops carrying information. Better to show no badge
// than a meaningless one.
export function getNutritionFlags(totals: NutritionTotals | null): string[] {
  if (!totals || !totals.perServing) return [];
  const flags: string[] = [];
  for (const n of NUTRIENT_DEFS) {
    if (!n.flagLabel || n.threshold == null) continue;
    const value = totals[n.key];
    if (value != null && value >= n.threshold) flags.push(n.flagLabel);
  }
  return flags;
}
