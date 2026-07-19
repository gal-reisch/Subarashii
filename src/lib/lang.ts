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
