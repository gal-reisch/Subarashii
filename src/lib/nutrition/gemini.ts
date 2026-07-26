import { generateJson } from "../gemini";
import type { Per100g } from "./types";

// Transport (model selection, timeout, never-throw, structured output) lives
// in `lib/gemini.ts` and is shared with the recipe-extraction prompts. This
// file owns only the nutrition prompt and its response schema.
const TIMEOUT_MS = 8000;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    grams: { type: "NUMBER" },
    calories: { type: "NUMBER" },
    protein_g: { type: "NUMBER" },
    carbs_g: { type: "NUMBER" },
    fat_g: { type: "NUMBER" },
    fiber_g: { type: "NUMBER" },
    sugar_g: { type: "NUMBER" },
  },
  required: ["grams", "calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g"],
};

/** An absolute estimate for one ingredient line, plus the weight the model
 *  assumed when making it. */
export type LineEstimate = Per100g & { grams: number | null };

// LLM fallback for ingredient lines that neither USDA nor Tzameret could
// match. Returns ABSOLUTE values for the line as written (e.g. "2 cups
// flour" -> the nutrition in 2 cups of flour, not per-100g) since the model
// can reason about the stated quantity directly. Returns null (never
// throws) if GEMINI_API_KEY isn't set yet, or on any request/parse failure
// — callers treat null exactly like "no estimate available", leaving the
// ingredient's nutrition columns blank rather than guessing further.
//
// `grams` is asked for alongside the nutrients, not because anything
// displays a per-ingredient weight, but because a recipe's per-100g calorie
// density is `total calories / total grams` and this path had been the hole
// in that sum. The database matchers resolve a real weight before scaling
// (see scalePer100g); the estimator used to answer in absolute nutrients
// with no weight attached, so any recipe whose ingredients mostly fell
// through to here had calories but no denominator. Since the model has to
// settle on a quantity internally to answer at all, asking it to state that
// quantity costs nothing and makes the two paths comparable.
export async function estimateNutrition(raw_text: string): Promise<LineEstimate | null> {
  const prompt = `Estimate the total nutrition contributed by this single recipe ingredient line, as written (use the stated quantity, not per 100g):\n\n"${raw_text}"\n\nAlso report "grams": the total edible weight in grams of that same quantity — the weight your nutrition numbers describe. For a line with no explicit weight ("2 cups flour", "3 cloves garlic", "a pinch of salt"), convert your assumed typical quantity to grams.\n\nRespond with your best estimate even if the line is vague — pick a reasonable typical interpretation.`;

  const parsed = await generateJson<Record<string, unknown>>({
    parts: [{ text: prompt }],
    schema: RESPONSE_SCHEMA,
    timeoutMs: TIMEOUT_MS,
  });
  if (!parsed) return null;

  const per100g: Per100g = {
    calories: numOrNull(parsed.calories),
    protein_g: numOrNull(parsed.protein_g),
    carbs_g: numOrNull(parsed.carbs_g),
    fat_g: numOrNull(parsed.fat_g),
    fiber_g: numOrNull(parsed.fiber_g),
    sugar_g: numOrNull(parsed.sugar_g),
  };
  if (Object.values(per100g).every((v) => v == null)) return null;

  // A zero or negative weight would poison the density sum it feeds, and
  // "0 g" is never a true answer for something listed as an ingredient.
  const grams = numOrNull(parsed.grams);
  return { ...per100g, grams: grams != null && grams > 0 ? grams : null };
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}
