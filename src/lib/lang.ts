export type Lang = "he" | "en";

const HEBREW = /[֐-׿]/;

// Best-effort language detection for a block of recipe text.
// Hebrew if it contains any Hebrew characters, otherwise English.
export function detectLang(text: string): Lang {
  return HEBREW.test(text) ? "he" : "en";
}

// Whether a string should render right-to-left (contains Hebrew).
export function isRtl(text: string): boolean {
  return HEBREW.test(text);
}

// `dir` attribute value for a given string, for per-line direction in the UI.
export function dirFor(text: string): "rtl" | "ltr" {
  return isRtl(text) ? "rtl" : "ltr";
}

// How much of a recipe has to be Hebrew before the whole page is treated as a
// Hebrew page. Not `isRtl` over the concatenation: a single Hebrew word in an
// otherwise English recipe ("serve with פיתה") would flip the entire layout,
// and one stray English line in a Hebrew recipe shouldn't stop it flipping.
// A third is deliberately low — a Hebrew recipe whose title and ingredients
// came from an English-language site still reads as Hebrew to the cook.
const HEBREW_SHARE_FOR_RTL = 1 / 3;

/**
 * The language a whole recipe should be *presented* in, which is a different
 * question from what any individual line is written in.
 *
 * Direction only. This used to pick the recipe page's section headings too,
 * out of an English and a Hebrew table; the app's own copy is now English on
 * every recipe, so the single thing left riding on this is whether the body
 * is mirrored. The per-line `dirFor` calls still handle mixed content inside
 * that.
 *
 * `stored` is the recipe's `primary_language` column, trusted when present —
 * it's set at import time from the source itself. Rows saved before that
 * column was populated fall back to counting lines.
 */
export function recipeLang(
  stored: string | null | undefined,
  texts: string[],
): Lang {
  if (stored === "he" || stored === "en") return stored;
  const lines = texts.filter((t) => t && t.trim());
  if (lines.length === 0) return "en";
  const hebrew = lines.filter((t) => HEBREW.test(t)).length;
  return hebrew / lines.length >= HEBREW_SHARE_FOR_RTL ? "he" : "en";
}
