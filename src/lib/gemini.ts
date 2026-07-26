// Minimal Gemini REST client, shared by every LLM call in the app.
//
// Extracted from `lib/nutrition/gemini.ts` (which was the first caller) once
// the recipe-from-caption and recipe-from-screenshot paths needed the exact
// same request/parse/never-throw boilerplate. That file still owns the
// nutrition prompt + schema; only the transport lives here.
//
// Two rules this module exists to enforce in one place:
//   1. It NEVER throws. Every failure — missing API key, non-2xx, timeout,
//      malformed JSON, safety block — comes back as `null`. Callers treat
//      null as "no answer available" and degrade to whatever they'd do if
//      the LLM weren't configured at all. A saved recipe is never lost to a
//      Gemini outage.
//   2. Structured output only. Every call passes a `responseSchema`, so the
//      model can't wander into prose and there's no markdown-fence stripping
//      anywhere in the codebase.

// Overridable via env since Google's model lineup moves fast — bump
// GEMINI_MODEL if this default gets deprecated. "gemini-2.0-flash" and
// "gemini-2.5-flash" were tried first but come back dead for freshly-created
// API keys (0 free-tier quota / "no longer available to new users",
// confirmed via direct curl against the REST API on 2026-07-21). The
// "-latest" aliases stay pointed at whatever the current generation is, so
// prefer those over a pinned version to avoid this rotting again.
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";

const DEFAULT_TIMEOUT_MS = 8000;

/** A single `contents[0].parts[]` entry: text, or a base64 inline image. */
export type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

/**
 * One structured-output generation. Returns the parsed JSON (typed by the
 * caller, matching the schema it passed) or null on any failure.
 *
 * `timeoutMs` defaults to 8s, which suits a one-line nutrition lookup. Give
 * whole-recipe extraction and anything with images a much larger budget —
 * they routinely take 15-30s.
 */
export async function generateJson<T>(opts: {
  parts: GeminiPart[];
  schema: unknown;
  timeoutMs?: number;
}): Promise<T | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: opts.parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: opts.schema,
        },
      }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, unknown>;
    const candidates = data.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) return null;
    const content = (candidates[0] as Record<string, unknown>).content as
      | Record<string, unknown>
      | undefined;
    const parts = content?.parts;
    if (!Array.isArray(parts) || parts.length === 0) return null;
    const text = (parts[0] as Record<string, unknown>).text;
    if (typeof text !== "string") return null;

    return JSON.parse(text) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
