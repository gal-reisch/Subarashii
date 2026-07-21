// Shared shape produced by every matching path (USDA / Tzameret / Gemini
// estimate) and written straight onto an `ingredient` row.
export interface IngredientNutrition {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  grams_resolved: number | null;
  fdc_source: "usda" | "tzameret" | "none";
  is_estimated: boolean;
}

// Per-100g nutrient values, the common currency both real databases report
// in — everything gets scaled from this by resolved grams.
export interface Per100g {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
}

export function scalePer100g(per100g: Per100g, grams: number): Omit<IngredientNutrition, "fdc_source" | "is_estimated"> {
  const factor = grams / 100;
  const scale = (v: number | null) => (v == null ? null : Math.round(v * factor * 100) / 100);
  return {
    calories: scale(per100g.calories),
    protein_g: scale(per100g.protein_g),
    carbs_g: scale(per100g.carbs_g),
    fat_g: scale(per100g.fat_g),
    fiber_g: scale(per100g.fiber_g),
    sugar_g: scale(per100g.sugar_g),
    grams_resolved: grams,
  };
}
