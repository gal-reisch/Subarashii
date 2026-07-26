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
export const NUTRIENT_DEFS: {
  key: (typeof NUTRITION_KEYS)[number];
  label: string;
  unit: string;
  bg: string;
  text: string;
  flagLabel?: string;
  threshold?: number;
}[] = [
  { key: "calories", label: "Calories", unit: "kcal", bg: "bg-warn-bg", text: "text-warn-text" },
  {
    key: "protein_g",
    label: "Protein",
    unit: "g",
    bg: "bg-cat-protein-bg",
    text: "text-cat-protein-text",
    flagLabel: "High Protein",
    threshold: 20,
  },
  { key: "carbs_g", label: "Carbs", unit: "g", bg: "bg-info-bg", text: "text-info-text" },
  {
    key: "fat_g",
    label: "Fat",
    unit: "g",
    bg: "bg-cat-fat-bg",
    text: "text-cat-fat-text",
    flagLabel: "High Fat",
    threshold: 20,
  },
  {
    key: "fiber_g",
    label: "Fiber",
    unit: "g",
    bg: "bg-cat-fiber-bg",
    text: "text-cat-fiber-text",
    flagLabel: "High Fiber",
    threshold: 5,
  },
  {
    key: "sugar_g",
    label: "Sugar",
    unit: "g",
    bg: "bg-cat-sugar-bg",
    text: "text-cat-sugar-text",
    flagLabel: "High Sugar",
    threshold: 15,
  },
];

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
