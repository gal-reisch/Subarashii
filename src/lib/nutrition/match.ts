import type { Lang } from "../lang";
import { estimateNutrition } from "./gemini";
import { searchTzameret } from "./tzameret";
import type { IngredientNutrition } from "./types";
import { scalePer100g } from "./types";
import { parseIngredientLine, toGrams } from "./units";
import { searchUsda } from "./usda";

// The LLM extractor prefixes each ingredient with its section header
// ("לרוטב — 3 שיני שום", "For the sauce — 3 garlic cloves") so a recipe with
// a dough/sauce/topping split still reads correctly as a flat list. That
// prefix is display metadata, not part of the food name — but
// `parseIngredientLine` sees a word where it expects a quantity, gives up,
// and the ingredient falls all the way through to the LLM estimator instead
// of the Tzameret/USDA tables.
//
// This was silently degrading every section-split recipe: the same line,
// "500 גרם בשר בקר טחון", resolved to 825 kcal from Tzameret when stored
// bare and to a 1250 kcal guess when stored with a "לקציצות — " prefix.
// Whole recipes were reading ~50% high for no reason visible to the user.
//
// Only the leading segment before the first em dash is removed, and only
// when something is left over. Em dash specifically: en dashes and hyphens
// show up inside real ingredient names ("סוכר חום בהיר – דמררה",
// "sun-dried tomatoes"), the em dash is what the extractor emits.
const SECTION_PREFIX = /^[^—\n]{1,40}\s+—\s+/;

function stripSectionPrefix(raw: string): string {
  const stripped = raw.replace(SECTION_PREFIX, "").trim();
  return stripped || raw;
}

// Older imports stored the section header as its own ingredient row
// ("לקציצות:") rather than prefixing the lines under it. It isn't food:
// there's no quantity and it ends in a colon. Skipping it here saves a
// pointless estimator call and, more importantly, stops the model being
// asked to put a calorie count on a heading — which it will happily do.
const SECTION_HEADER = /^[^\d]{1,40}:\s*$/;

// Real database match first (Tzameret for Hebrew, USDA for English), LLM
// estimate as a clearly-flagged fallback. Never throws — every sub-call
// already swallows its own errors, and a `null` return here just means the
// ingredient's nutrition columns stay null. See src/lib/recipes.ts for how
// this plugs into saving a recipe.
export async function matchIngredientNutrition(
  rawTextWithPrefix: string,
  language: Lang,
): Promise<IngredientNutrition | null> {
  const raw_text = stripSectionPrefix(rawTextWithPrefix);
  if (SECTION_HEADER.test(raw_text)) return null;

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
