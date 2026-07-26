import { generateJson, isGeminiConfigured, type GeminiPart } from "../gemini";

// LLM recipe extraction — turns unstructured input into the same
// ingredients/steps shape the JSON-LD path produces.
//
// Why this exists: `parser/text.ts` splits free text with line-shape
// heuristics (does the line start with a quantity? does it end in a period?).
// That works on a tidy pasted block and falls apart on a real Instagram
// caption, which is one run-on paragraph of prose with the ingredient list
// buried in the middle, sub-headings like "לקציצות:" / "for the sauce:", and
// forty hashtags glued to the end. The model handles all of that, and handles
// it in Hebrew, which the regexes only half-managed.
//
// Used by two callers:
//   - `parser/index.ts` — social captions scraped from og:description.
//   - the screenshot import flow — same prompt, image parts instead of text.
//
// Returns null on anything less than a usable result (no API key, request
// failure, or a response with no ingredients AND no steps), so callers can
// fall back to the heuristic splitter and still save the link.

const TIMEOUT_MS = 30_000;

// `servings` and `total_time_min` are deliberately NOT in `required`: a
// caption very often states neither, and forcing the field makes the model
// invent one. Same for `cuisine`.
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    servings: { type: "INTEGER" },
    total_time_min: { type: "INTEGER" },
    cuisine: { type: "STRING" },
    ingredients: { type: "ARRAY", items: { type: "STRING" } },
    steps: { type: "ARRAY", items: { type: "STRING" } },
    is_recipe: { type: "BOOLEAN" },
  },
  required: ["title", "ingredients", "steps", "is_recipe"],
};

const INSTRUCTIONS = `You are extracting a cooking recipe into structured data for a personal recipe box.

Rules:
- Preserve the ORIGINAL LANGUAGE of the source. If the recipe is in Hebrew, every ingredient and step must stay in Hebrew. Never translate.
- "ingredients": one entry per ingredient line, keeping the quantity and unit exactly as written. If the recipe is split into sections (e.g. "for the meatballs" / "for the sauce"), prefix each entry with its section name followed by " — " so the grouping survives.
- "steps": one entry per discrete instruction, in order. Split a run-on instruction paragraph into separate steps at the natural boundaries. Do not number them; the app numbers them.
- Do NOT invent anything. Omit "servings", "total_time_min" and "cuisine" entirely unless the source actually states or clearly implies them. Never output a placeholder like 0 or "unknown".
- Strip social-media chatter: hashtags, "follow for more", tagged accounts, like/comment counts, emoji-only lines. Keep genuine cooking notes as steps.
- "title": the name of the dish that is ACTUALLY BEING MADE, in the source language. Work it out from the ingredients and steps — do not just copy the headline. Publishers pad headlines with editorial framing that says nothing about the food ("המדריך:", "מתכון:", "The Guide:", "Recipe:", "How to make", "You have to try this"), plus author handles, hashtags and clickbait. Strip all of it and keep only the dish. Example: a page headlined "המדריך: תבשיל אסאדו בבצלים וסילאן" is a recipe for "תבשיל אסאדו בבצלים וסילאן" — "המדריך" is not part of the dish name. If the headline names no dish at all, name the dish yourself from what is being cooked.
- "is_recipe": false if the source contains no actual recipe (just a photo caption, a login page, an ad). When false, leave the arrays empty.`;

export interface LlmRecipe {
  title: string | null;
  servings: number | null;
  total_time_min: number | null;
  cuisine: string | null;
  ingredients: string[];
  steps: string[];
}

interface RawLlmRecipe {
  title?: unknown;
  servings?: unknown;
  total_time_min?: unknown;
  cuisine?: unknown;
  ingredients?: unknown;
  steps?: unknown;
  is_recipe?: unknown;
}

// Hebrew writes abbreviations with a gershayim — ק״ג (kg), מ״ל (ml), ס״מ (cm) —
// and in practice everyone types it as an ASCII double quote: `ק"ג`. That
// character is poison for structured output: the constrained JSON decoder sees
// a raw `"` mid-string and closes the string there, so `1.5 ק"ג אסאדו` came
// back as an ingredient literally named `1.5 ק`. Swapping in the real U+05F4
// gershayim before the text is sent fixes it, and is what the source meant
// typographically anyway. Only a quote sandwiched between two Hebrew letters
// is touched, so ordinary quoted speech is left alone.
const HEBREW_GERSHAYIM = /(\p{Script=Hebrew})"(\p{Script=Hebrew})/gu;

function normalizeForModel(text: string): string {
  return text.replace(HEBREW_GERSHAYIM, "$1״$2");
}

/** Extract a recipe from a block of unstructured text (caption, paste, OCR). */
export async function extractRecipeFromText(text: string): Promise<LlmRecipe | null> {
  const trimmed = normalizeForModel(text.trim());
  // Below this there is nothing a model could find that the heuristics
  // couldn't, and it isn't worth a round trip.
  if (trimmed.length < 40) return null;
  return extract([{ text: `${INSTRUCTIONS}\n\n---\nSOURCE TEXT:\n\n${trimmed}` }]);
}

/** Extract a recipe from one or more screenshots of a recipe. */
export async function extractRecipeFromImages(
  images: { mimeType: string; data: string }[],
): Promise<LlmRecipe | null> {
  if (images.length === 0) return null;
  return extract([
    {
      text: `${INSTRUCTIONS}\n\nThe source is ${
        images.length === 1 ? "a screenshot" : `${images.length} screenshots, in order,`
      } of a recipe. Read all visible text, including text baked into the image. If the screenshots overlap, merge them without duplicating lines.`,
    },
    ...images.map((img) => ({ inlineData: img })),
  ]);
}

export { isGeminiConfigured };

async function extract(parts: GeminiPart[]): Promise<LlmRecipe | null> {
  const raw = await generateJson<RawLlmRecipe>({
    parts,
    schema: RESPONSE_SCHEMA,
    timeoutMs: TIMEOUT_MS,
  });
  if (!raw) return null;
  if (raw.is_recipe === false) return null;

  const ingredients = stringList(raw.ingredients);
  const steps = stringList(raw.steps);
  // A result with neither half is worse than no result — the caller's
  // fallback path at least keeps the link and flags it for review.
  if (ingredients.length === 0 && steps.length === 0) return null;

  return {
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : null,
    servings: positiveInt(raw.servings),
    total_time_min: positiveInt(raw.total_time_min),
    cuisine:
      typeof raw.cuisine === "string" && raw.cuisine.trim() ? raw.cuisine.trim() : null,
    ingredients,
    steps,
  };
}

function stringList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Guards against the model emitting 0 as "I don't know" despite the prompt.
function positiveInt(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null;
}
