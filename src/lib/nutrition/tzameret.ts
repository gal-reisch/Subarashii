import { fetchJsonWithRetry } from "./http";
import { isRelevantMatch } from "./relevance";
import type { Per100g } from "./types";

// Israeli Ministry of Health food-composition database ("Tzameret"), served
// live via data.gov.il's CKAN datastore_search API — confirmed field names
// against a real query (see plan): shmmitzrach (Hebrew name), protein,
// total_fat, carbohydrates, food_energy (kcal), total_dietary_fiber,
// total_sugars — all per-100g.
//
// Never throws — any failure (network, timeout, no results, malformed
// response) yields null so the caller falls through to the LLM estimate.
// Uses fetchJsonWithRetry (see http.ts) for the same reason usda.ts does:
// government/gov-adjacent API gateways in this pipeline have shown
// transient, content-independent failures under live testing, worth
// absorbing with a short retry rather than dropping a real match.
export async function searchTzameret(foodNameHebrew: string): Promise<Per100g | null> {
  const resourceId = process.env.TZAMERET_RESOURCE_ID;
  if (!resourceId) return null;

  const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=${resourceId}&q=${encodeURIComponent(foodNameHebrew)}&limit=1`;

  const data = await fetchJsonWithRetry(url);
  if (!data || typeof data !== "object") return null;
  const result = (data as Record<string, unknown>).result as Record<string, unknown> | undefined;
  const records = result?.records;
  if (!Array.isArray(records) || records.length === 0) return null;

  const rec = records[0] as Record<string, unknown>;

  // Same relevance guard as usda.ts (see relevance.ts) — datastore_search
  // is full-text search, not a confidence match, so reject a "top result"
  // that doesn't actually share the food name's content words.
  const name = String(rec.shmmitzrach ?? rec.english_name ?? "");
  if (!isRelevantMatch(foodNameHebrew, name)) return null;

  const per100g: Per100g = {
    calories: numOrNull(rec.food_energy),
    protein_g: numOrNull(rec.protein),
    carbs_g: numOrNull(rec.carbohydrates),
    fat_g: numOrNull(rec.total_fat),
    fiber_g: numOrNull(rec.total_dietary_fiber),
    sugar_g: numOrNull(rec.total_sugars),
  };
  if (Object.values(per100g).every((v) => v == null)) return null;
  return per100g;
}

function numOrNull(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}
