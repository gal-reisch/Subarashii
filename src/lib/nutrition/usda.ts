import { fetchJsonWithRetry } from "./http";
import { isRelevantMatch } from "./relevance";
import type { Per100g } from "./types";

const FDC_BASE = "https://api.nal.usda.gov/fdc/v1";

export interface UsdaMatch {
  per100g: Per100g;
  /** Ingredient-specific household-measure gram weights, e.g. "cup" -> 240.
   *  Keyed by lowercased measure name; only populated when the detail
   *  lookup succeeds. Preferred over the generic conversion table in
   *  units.ts when a matching key exists. */
  portionsGramsByMeasure: Record<string, number>;
}

// The FDC API reports nutrients in two different shapes depending on
// endpoint/dataType: flat {nutrientName, value} (search results, most
// dataTypes) or nested {nutrient: {name}, amount} (some detail responses).
// Handle both rather than trusting one shape.
//
// Foundation/SR Legacy foods list "Energy" TWICE per food — once in KJ,
// once in KCAL — so a plain first-keyword-match grabs whichever comes
// first, which is the KJ figure about as often as not (confirmed live:
// "flour" -> 1490 KJ read as if it were 1490 kcal, ~4x too high). When a
// `preferredUnit` is given, prefer the entry whose unit matches it over
// just taking the first keyword hit.
// "fatty acid" sub-component entries (e.g. "Fatty acids, total saturated",
// "...monounsaturated") are excluded globally: confirmed live that a plain
// "fat" keyword substring-matches "Fatty acids, total saturated" (the word
// "fatty" contains "fat"), and that entry sits BEFORE "Total lipid (fat)" in
// USDA's array for a real food ("egg whole": saturated fat 3.2g picked up
// instead of total fat 9.96g — a ~3x understatement). None of the other
// nutrient fields we extract (energy/protein/carbohydrate/fiber/sugars) have
// a legitimate "fatty acid ..." entry, so this exclusion is safe everywhere,
// not just for the fat field.
const EXCLUDE_SUBSTRINGS = ["fatty acid"];

function extractNutrient(foodNutrients: unknown, keywords: string[], preferredUnit?: string): number | null {
  if (!Array.isArray(foodNutrients)) return null;
  let firstMatch: number | null = null;
  for (const n of foodNutrients) {
    if (typeof n !== "object" || n === null) continue;
    const rec = n as Record<string, unknown>;
    const nutrientObj = rec.nutrient as Record<string, unknown> | undefined;
    const name = String(rec.nutrientName ?? nutrientObj?.name ?? "").toLowerCase();
    if (!name) continue;
    if (EXCLUDE_SUBSTRINGS.some((x) => name.includes(x))) continue;
    if (keywords.some((k) => name.includes(k))) {
      const value = rec.value ?? rec.amount;
      if (typeof value !== "number") continue;
      if (firstMatch == null) firstMatch = value;
      const unit = String(rec.unitName ?? nutrientObj?.unitName ?? "").toLowerCase();
      if (preferredUnit && unit === preferredUnit.toLowerCase()) return value;
    }
  }
  return firstMatch;
}

function per100gFrom(foodNutrients: unknown): Per100g {
  return {
    calories: extractNutrient(foodNutrients, ["energy"], "kcal"),
    protein_g: extractNutrient(foodNutrients, ["protein"]),
    carbs_g: extractNutrient(foodNutrients, ["carbohydrate"]),
    fat_g: extractNutrient(foodNutrients, ["total lipid", "fat"]),
    fiber_g: extractNutrient(foodNutrients, ["fiber"]),
    sugar_g: extractNutrient(foodNutrients, ["sugars"]),
  };
}

// USDA sometimes returns several results tied at the exact same relevance
// score for a bare, unqualified ingredient — confirmed live: "egg" returns
// "Eggs, ... egg white", "... egg whole", and "... egg yolk" all scored
// identically (338.28815), with "egg white" listed first. Taking a blind
// foods[0] there silently records egg-white-only nutrition (~0g fat) for
// what a recipe author meant as a whole egg. Guard against this narrow but
// high-impact case: if the query doesn't itself mention one of these
// component words, skip a candidate that does, in favor of the next one
// that still passes the relevance check.
const COMPONENT_QUALIFIERS = ["white", "yolk"];

function pickBestFood(foods: unknown[], foodName: string): Record<string, unknown> | null {
  const queryLower = foodName.toLowerCase();
  const queryMentionsQualifier = COMPONENT_QUALIFIERS.some((w) => queryLower.includes(w));

  let firstRelevant: Record<string, unknown> | null = null;
  for (const f of foods) {
    if (typeof f !== "object" || f === null) continue;
    const rec = f as Record<string, unknown>;
    const description = String(rec.description ?? "");
    if (!isRelevantMatch(foodName, description)) continue;
    if (firstRelevant == null) firstRelevant = rec;
    if (queryMentionsQualifier) return rec;
    const descLower = description.toLowerCase();
    const hasUnrequestedQualifier = COMPONENT_QUALIFIERS.some((w) => descLower.includes(w));
    if (!hasUnrequestedQualifier) return rec;
  }
  // Nothing avoided every qualifier word — fall back to the first relevant
  // match rather than giving up (better a plausible real match than none).
  return firstRelevant;
}

// Never throws — any failure (network, no results, malformed response)
// yields null so the caller falls through to the LLM estimate.
export async function searchUsda(foodName: string): Promise<UsdaMatch | null> {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) return null;

  // Restrict to the generic/reference data types (Foundation, SR Legacy,
  // Survey/FNDDS) and exclude "Branded" — branded products are often named
  // after the plain ingredient itself (a candy literally named "EGG" was
  // the real top hit for a bare "egg" search during live testing) and their
  // nutrition reflects that specific manufactured product, not the
  // ingredient as written in a recipe.
  //
  // Built with URLSearchParams rather than manual encodeURIComponent
  // concatenation: confirmed live that USDA's API gateway 400s on a
  // %20-encoded space inside a query value (curl -G --data-urlencode vs.
  // manual %20 encoding) but accepts URLSearchParams' "+"-for-space,
  // application/x-www-form-urlencoded-style output.
  // pageSize 10 (not 1): we need to look past the literal top hit to apply
  // the component-qualifier and relevance checks below — see pickBestFood.
  const searchParams = new URLSearchParams({
    query: foodName,
    pageSize: "10",
    dataType: "Foundation,SR Legacy,Survey (FNDDS)",
    api_key: apiKey,
  });
  const searchUrl = `${FDC_BASE}/foods/search?${searchParams.toString()}`;
  const searchData = await fetchJsonWithRetry(searchUrl);
  if (!searchData || typeof searchData !== "object") return null;
  const foods = (searchData as Record<string, unknown>).foods;
  if (!Array.isArray(foods) || foods.length === 0) return null;

  // USDA's search is relevance-ranked full-text, not a confidence match —
  // it will happily return an unrelated top hit for a garbage/unmatchable
  // line (e.g. "dragon whiskers" -> "Dragon fruit"). pickBestFood rejects
  // candidates that don't share all of the food name's content words (via
  // isRelevantMatch) and additionally steers around the egg-white/whole/yolk
  // tied-score trap described above it.
  const top = pickBestFood(foods, foodName);
  if (!top) return null;

  const per100g = per100gFrom(top.foodNutrients);
  if (Object.values(per100g).every((v) => v == null)) return null;

  const portionsGramsByMeasure: Record<string, number> = {};
  const fdcId = top.fdcId;
  if (typeof fdcId === "number") {
    const detailUrl = `${FDC_BASE}/food/${fdcId}?api_key=${apiKey}`;
    const detail = await fetchJsonWithRetry(detailUrl);
    const portions = detail && typeof detail === "object" ? (detail as Record<string, unknown>).foodPortions : null;
    if (Array.isArray(portions)) {
      for (const p of portions) {
        if (typeof p !== "object" || p === null) continue;
        const rec = p as Record<string, unknown>;
        const measureUnit = rec.measureUnit as Record<string, unknown> | undefined;
        const measureName = String(measureUnit?.name ?? "").toLowerCase();
        const gramWeight = rec.gramWeight;
        if (measureName && typeof gramWeight === "number") {
          portionsGramsByMeasure[measureName] = gramWeight;
        }
      }
    }
  }

  return { per100g, portionsGramsByMeasure };
}
