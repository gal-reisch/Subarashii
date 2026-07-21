import type { Lang } from "../lang";

export interface ParsedIngredientLine {
  quantity: number;
  /** Canonical unit key (see UNIT_TABLE), or "item" when no known unit word
   *  was found — the ingredient's own name doubles as the countable unit
   *  (e.g. "3 eggs"). */
  unit: string;
  /** Remaining text used as the food-database search query. */
  foodName: string;
}

const FRACTION_MAP: Record<string, number> = {
  "½": 0.5,
  "¼": 0.25,
  "¾": 0.75,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};
const FRACTION_CHARS = Object.keys(FRACTION_MAP).join("");

// A single quantity token: a plain number, a "1/2"-style fraction, or a
// unicode vulgar fraction.
const QTY_TOKEN = `(?:\\d+(?:\\.\\d+)?|\\d+\\s*\\/\\s*\\d+|[${FRACTION_CHARS}])`;
// Optionally two tokens back to back for mixed numbers ("1 ½", "1 1/2").
const QTY_RE = new RegExp(`^\\s*(${QTY_TOKEN})(?:\\s+(${QTY_TOKEN}))?`);

function parseToken(token: string): number {
  if (token in FRACTION_MAP) return FRACTION_MAP[token];
  if (token.includes("/")) {
    const [num, den] = token.split("/").map((s) => parseFloat(s.trim()));
    return den ? num / den : num;
  }
  return parseFloat(token);
}

function extractLeadingQuantity(text: string): { quantity: number; rest: string } | null {
  const m = QTY_RE.exec(text);
  if (!m) return null;
  let quantity = parseToken(m[1]);
  if (m[2]) quantity += parseToken(m[2]);
  if (!isFinite(quantity) || quantity <= 0) return null;
  return { quantity, rest: text.slice(m[0].length).trim() };
}

interface UnitDef {
  /** Approximate grams for one unit. Weight units are exact; volume/count
   *  units are generic averages (documented limitation — see units.ts
   *  callers) used only when a food-specific USDA portion isn't available. */
  gramsPerUnit: number;
  aliases: string[];
}

// English + Hebrew surface forms per canonical unit. Matching is
// case-insensitive and ignores a trailing "." (e.g. "tbsp.").
const UNIT_TABLE: Record<string, UnitDef> = {
  g: { gramsPerUnit: 1, aliases: ["g", "gr", "gram", "grams", "גרם", "גר"] },
  kg: { gramsPerUnit: 1000, aliases: ["kg", "kilogram", "kilograms", "קילו", "קילוגרם", 'ק"ג'] },
  oz: { gramsPerUnit: 28.35, aliases: ["oz", "ounce", "ounces"] },
  lb: { gramsPerUnit: 453.6, aliases: ["lb", "lbs", "pound", "pounds"] },
  ml: { gramsPerUnit: 1, aliases: ["ml", "milliliter", "milliliters", 'מ"ל', "מיליליטר"] },
  l: { gramsPerUnit: 1000, aliases: ["l", "liter", "liters", "ליטר"] },
  cup: { gramsPerUnit: 240, aliases: ["cup", "cups", "כוס", "כוסות"] },
  tbsp: { gramsPerUnit: 15, aliases: ["tbsp", "tablespoon", "tablespoons", "כף", "כפות"] },
  tsp: { gramsPerUnit: 5, aliases: ["tsp", "teaspoon", "teaspoons", "כפית", "כפיות"] },
  clove: { gramsPerUnit: 5, aliases: ["clove", "cloves", "שן", "שיני"] },
  slice: { gramsPerUnit: 30, aliases: ["slice", "slices", "פרוסה", "פרוסות"] },
  // Generic fallback for a bare count ("3 eggs", "2 onions") — the word
  // itself becomes part of the food name, not stripped off.
  item: { gramsPerUnit: 50, aliases: ["piece", "pieces", "unit", "units", "יחידה", "יחידות"] },
};

function findUnit(word: string): string | null {
  const norm = word.toLowerCase().replace(/\.$/, "");
  for (const [key, def] of Object.entries(UNIT_TABLE)) {
    if (def.aliases.includes(norm)) return key;
  }
  return null;
}

export function parseIngredientLine(raw_text: string, _language: Lang): ParsedIngredientLine | null {
  const qty = extractLeadingQuantity(raw_text);

  // No leading number ("כוס קמח" / "an egg" / "cup of flour") is completely
  // normal ingredient phrasing, not just "1 cup flour". If the line doesn't
  // start with a digit but *does* start with a recognized unit word, treat
  // it as an implicit quantity of 1 rather than giving up and sending an
  // otherwise-parseable line straight to the LLM fallback.
  if (!qty) {
    const words = raw_text.trim().split(/\s+/);
    const unitKey = findUnit(words[0] ?? "");
    if (!unitKey) return null;
    const foodName = words.slice(1).join(" ").trim();
    if (!foodName) return null;
    return { quantity: 1, unit: unitKey, foodName };
  }
  if (!qty.rest) return null;

  const words = qty.rest.split(/\s+/);
  const firstWord = words[0];
  const unitKey = findUnit(firstWord);

  const unit = unitKey ?? "item";
  const foodName = unitKey ? words.slice(1).join(" ").trim() : qty.rest;

  if (!foodName) return null;
  return { quantity: qty.quantity, unit, foodName };
}

/**
 * Converts a parsed quantity to grams. `overrideGramsPerUnit` lets callers
 * (usda.ts, via a food-specific USDA foodPortions match) supply an
 * ingredient-specific gram weight instead of the generic table value —
 * always preferred when available since real household-measure weights vary
 * a lot by ingredient (a cup of flour != a cup of sugar).
 */
export function toGrams(quantity: number, unit: string, overrideGramsPerUnit?: number): number | null {
  if (overrideGramsPerUnit != null) return quantity * overrideGramsPerUnit;
  const def = UNIT_TABLE[unit];
  if (!def) return null;
  return quantity * def.gramsPerUnit;
}
