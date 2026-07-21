import type { Per100g } from "./types";

const TIMEOUT_MS = 8000;
// Overridable via env since Google's model lineup moves fast — bump
// GEMINI_MODEL if this default gets deprecated. "gemini-2.0-flash" and
// "gemini-2.5-flash" were tried first but come back dead for freshly-created
// API keys (0 free-tier quota / "no longer available to new users",
// confirmed via direct curl against the REST API on 2026-07-21). The
// "-latest" aliases stay pointed at whatever the current generation is, so
// prefer those over a pinned version to avoid this rotting again.
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";

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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const prompt = `Estimate the total nutrition contributed by this single recipe ingredient line, as written (use the stated quantity, not per 100g):\n\n"${raw_text}"\n\nRespond with your best estimate even if the line is vague — pick a reasonable typical interpretation.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    const candidates = data.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) return null;
    const content = (candidates[0] as Record<string, unknown>).content as Record<string, unknown> | undefined;
    const parts = content?.parts;
    if (!Array.isArray(parts) || parts.length === 0) return null;
    const text = (parts[0] as Record<string, unknown>).text;
    if (typeof text !== "string") return null;

    const parsed = JSON.parse(text) as Record<string, unknown>;
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
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}
