import { generateJson } from "../gemini";
import type { Per100g } from "./types";

// Transport (model selection, timeout, never-throw, structured output) lives
// in `lib/gemini.ts` and is shared with the recipe-extraction prompts. This
// file owns only the nutrition prompt and its response schema.
const TIMEOUT_MS = 8000;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    calories: { type: "NUMBER" },
    protein_g: { type: "NUMBER" },
    carbs_g: { type: "NUMBER" },
    fat_g: { type: "NUMBER" },
    fiber_g: { type: "NUMBER" },
    sugar_g: { type: "NUMBER" },
  },
  required: ["calories", "protein_g", "carbs_g", "fat_g", "fiber_g", "sugar_g"],
};

// LLM fallback for ingredient lines that neither USDA nor Tzameret could
// match. Returns ABSOLUTE values for the line as written (e.g. "2 cups
// flour" -> the nutrition in 2 cups of flour, not per-100g) since the model
// can reason about the stated quantity directly. Returns null (never
// throws) if GEMINI_API_KEY isn't set yet, or on any request/parse failure
// — callers treat null exactly like "no estimate available", leaving the
// ingredient's nutrition columns blank rather than guessing further.
export async function estimateNutrition(raw_text: string): Promise<Per100g | null> {
  const prompt = `Estimate the total nutrition contributed by this single recipe ingredient line, as written (use the stated quantity, not per 100g):\n\n"${raw_text}"\n\nRespond with your best estimate even if the line is vague — pick a reasonable typical interpretation.`;

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
  return per100g;
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}
