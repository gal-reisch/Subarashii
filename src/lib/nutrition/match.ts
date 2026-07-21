import type { Lang } from "../lang";
import { estimateNutrition } from "./gemini";
import { searchTzameret } from "./tzameret";
import type { IngredientNutrition } from "./types";
import { scalePer100g } from "./types";
import { parseIngredientLine, toGrams } from "./units";
import { searchUsda } from "./usda";

// Real database match first (Tzameret for Hebrew, USDA for English), LLM
// estimate as a clearly-flagged fallback. Never throws — every sub-call
// already swallows its own errors, and a `null` return here just means the
// ingredient's nutrition columns stay null. See src/lib/recipes.ts for how
// this plugs into saving a recipe.
export async function matchIngredientNutrition(
  raw_text: string,
  language: Lang,
): Promise<IngredientNutrition | null> {
  const parsed = parseIngredientLine(raw_text, language);

  if (parsed) {
    if (language === "he") {
      const per100g = await searchTzameret(parsed.foodName);
      if (per100g) {
        const grams = toGrams(parsed.quantity, parsed.unit);
        if (grams != null) {
          return { ...scalePer100g(per100g, grams), fdc_source: "tzameret", is_estimated: false };
        }
      }
    } else {
      const match = await searchUsda(parsed.foodName);
      if (match) {
        // Prefer a food-specific USDA portion weight (e.g. "this food's cup
        // = 210g") over the generic units.ts table when one's available.
        const override = match.portionsGramsByMeasure[parsed.unit];
        const grams = toGrams(parsed.quantity, parsed.unit, override);
        if (grams != null) {
          return { ...scalePer100g(match.per100g, grams), fdc_source: "usda", is_estimated: false };
        }
      }
    }
  }

  // Neither database matched (or the line couldn't be parsed into a
  // quantity+unit+food at all) — ask Gemini for an absolute estimate of the
  // line as written. Skipped for free (returns null) if no key is set yet.
  const estimate = await estimateNutrition(raw_text);
  if (estimate) {
    return {
      calories: estimate.calories,
      protein_g: estimate.protein_g,
      carbs_g: estimate.carbs_g,
      fat_g: estimate.fat_g,
      fiber_g: estimate.fiber_g,
      sugar_g: estimate.sugar_g,
      grams_resolved: null,
      fdc_source: "none",
      is_estimated: true,
    };
  }

  return null;
}
