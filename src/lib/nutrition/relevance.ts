// Guards against USDA/Tzameret's free-text search returning a confident-
// looking but unrelated "top result" for garbage or unmatchable ingredient
// lines (e.g. "pinch of dragon whiskers" fuzzy-matching "Dragon fruit" on
// the shared word "dragon" — found via live testing, see match.ts callers).
// Both APIs are plain relevance-ranked full-text search with no confidence
// score we can trust across queries, so we do our own word-overlap check:
// strip quantity/prep filler words, then require every remaining
// content-bearing word from the parsed food name to appear in the
// candidate's name/description. Filtering prep words first (not just
// requiring "any" word) is what lets real matches like "garlic, minced" vs.
// USDA's "Garlic, raw" still pass while rejecting coincidental single-word
// overlaps like the dragon fruit case.

const STOPWORDS = new Set([
  // English: articles/preps/connectors
  "a", "an", "the", "of", "and", "or", "to", "for", "at", "in", "with",
  // English: prep/descriptor words that rarely appear in a generic DB name
  "fresh", "raw", "cooked", "frozen", "dried", "canned", "chopped", "diced",
  "sliced", "minced", "crushed", "grated", "shredded", "ground", "cubed",
  "peeled", "seeded", "cored", "trimmed", "pinch", "dash", "taste",
  "optional", "plus", "more", "needed", "room", "temperature", "large",
  "small", "medium", "extra", "whole", "half",
  // Hebrew: connectors/preps
  "של", "עם", "עד", "או", "ו", "וה",
  // Hebrew: prep/descriptor words
  "טרי", "טריה", "קצוץ", "קצוצה", "פרוס", "פרוסה", "גדול", "גדולה", "קטן",
  "קטנה", "לפי", "טעם", "קר", "קרה", "חם", "חמה",
]);

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
}

function significantWords(text: string): string[] {
  return normalize(text)
    .split(" ")
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

// True if every content-bearing word of `foodName` shows up (as a
// substring, so plurals like "tomato"/"tomatoes" still match) somewhere in
// `candidateText`. If stripping filler words leaves nothing to check, we
// can't confirm relevance — treat as not a match rather than guessing.
export function isRelevantMatch(foodName: string, candidateText: string): boolean {
  const words = significantWords(foodName);
  if (words.length === 0) return false;
  const candidate = normalize(candidateText);
  return words.every((w) => candidate.includes(w));
}
