// Recipe *type* classification — "what kind of dish is this" (meat, dessert,
// pastry…), which is a different question from the `cuisine` field ("Italian",
// "Thai") that schema.org's `recipeCuisine` provides.
//
// Why this exists: the card used to label recipes with `cuisine ?? "Uncategorized"`,
// and since almost no source page publishes `recipeCuisine`, essentially every
// recipe rendered as "Uncategorized". Cuisine is also the wrong axis for the
// home-page filter chips — the user browses by "I want a dessert", not "I want
// something Peruvian".
//
// Design notes:
//   - Derived, not stored. Runs on `title` (+ `cuisine` and any extra text a
//     caller passes) at render time, so it applies retroactively to every
//     recipe already in the database with no migration and no backfill.
//   - Deterministic and offline: a keyword table, not an LLM call. The same
//     recipe always lands in the same bucket on both server and client
//     renders, which matters because the category also picks the card's color.
//   - Bilingual, because the recipe box is (Hebrew + English).
//   - Exactly six buckets, one per color family in the Figma palette, with
//     "general" reserved as the catch-all for anything that matches nothing.

export type RecipeCategory =
  | "meat"
  | "fish"
  | "veggie"
  | "pastry"
  | "dessert"
  | "general";

/** Canonical display order for filter chips — savory → baked → sweet, with the
 *  catch-all last so it never leads the list. */
export const CATEGORY_ORDER: RecipeCategory[] = [
  "meat",
  "fish",
  "veggie",
  "pastry",
  "dessert",
  "general",
];

/** Short display labels — used on both the card and the filter chips, so they
 *  need to stay narrow enough for an ~11px uppercase label on a half-width card. */
export const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  meat: "Meat",
  fish: "Fish",
  veggie: "Veggie",
  pastry: "Pastry",
  dessert: "Dessert",
  general: "General",
};

// Tie-break order when two categories match the same number of keywords.
// Protein-defining words win over technique/format words: "chicken pot pie"
// is a chicken dish, "beef wellington" is a beef dish. Dessert outranks
// pastry so "apple pie" and "chocolate tart" read as desserts rather than
// baked goods, while plain "sourdough" or "focaccia" still land in pastry.
const TIE_BREAK: RecipeCategory[] = ["fish", "meat", "dessert", "pastry", "veggie"];

const KEYWORDS: Record<Exclude<RecipeCategory, "general">, string[]> = {
  fish: [
    "fish", "salmon", "tuna", "cod", "halibut", "haddock", "trout", "tilapia",
    "sea bass", "seabass", "bass", "mackerel", "sardine", "sardines", "anchovy",
    "anchovies", "seafood", "shrimp", "prawn", "prawns", "squid", "calamari",
    "octopus", "mussel", "mussels", "clam", "clams", "scallop", "scallops",
    "crab", "lobster", "ceviche", "sashimi", "poke",
    "דג", "דגים", "סלמון", "טונה", "בקלה", "מושט", "לברק", "דניס", "בורי",
    "פירות ים", "שרימפס", "חסילונים", "קלמארי", "תמנון", "סרדינים",
  ],
  meat: [
    "meat", "chicken", "beef", "steak", "pork", "lamb", "veal", "turkey",
    "duck", "bacon", "ham", "sausage", "sausages", "salami", "pastrami",
    "meatball", "meatballs", "meatloaf", "brisket", "ribs", "rib", "mince",
    "ground beef", "schnitzel", "burger", "burgers", "hamburger", "kebab",
    "kofta", "shawarma", "roast", "wings", "drumstick", "drumsticks",
    "thigh", "thighs", "sirloin", "tenderloin", "chorizo", "prosciutto",
    "בשר", "עוף", "פרגית", "פרגיות", "חזה עוף", "כנפיים", "שוקיים", "סטייק",
    "אנטריקוט", "פילה", "כבש", "טלה", "הודו", "בקר", "נקניק", "נקניקיה",
    "נקניקיות", "קציצות", "קציצה", "שניצל", "המבורגר", "קבב", "שווארמה",
    "צלי", "כתף", "אסאדו", "פסטרמה",
  ],
  dessert: [
    "dessert", "cake", "cakes", "cupcake", "cupcakes", "cookie", "cookies",
    "brownie", "brownies", "blondie", "ice cream", "gelato", "sorbet",
    "mousse", "pudding", "custard", "brulee", "brûlée", "creme brulee",
    "cheesecake", "tart", "tarts", "pie", "chocolate", "caramel", "toffee",
    "fudge", "tiramisu", "macaron", "macarons", "macaroon", "meringue",
    "pavlova", "truffle", "truffles", "candy", "praline", "panna cotta",
    "trifle", "parfait", "eclair", "profiterole", "baklava", "halva",
    "sweet", "sweets", "frosting", "ganache", "compote", "jam",
    "קינוח", "קינוחים", "עוגה", "עוגת", "עוגיות", "עוגייה", "עוגיה",
    "בראוני", "גלידה", "סורבה", "מוס", "פודינג", "קרם ברולה", "קרמבו",
    "צ׳יזקייק", "טארט", "שוקולד", "קרמל", "טירמיסו", "מקרון", "מרנג",
    "פבלובה", "מתוק", "מתוקים", "בצק סוכר", "גנאש", "ריבה", "חלווה",
    "בקלאווה", "מלבי",
  ],
  pastry: [
    "bread", "dough", "pastry", "pastries", "croissant", "croissants",
    "bagel", "bagels", "bun", "buns", "roll", "rolls", "focaccia",
    "baguette", "ciabatta", "sourdough", "challah", "pita", "naan",
    "tortilla", "flatbread", "brioche", "scone", "scones", "muffin",
    "muffins", "biscuit", "biscuits", "pretzel", "pizza", "calzone",
    "empanada", "quiche", "puff pastry", "phyllo", "filo", "danish",
    "babka", "loaf", "bake", "baked", "baking", "yeast",
    "לחם", "לחמים", "בצק", "מאפה", "מאפים", "קרואסון", "בייגל", "בייגלה",
    "לחמניה", "לחמניות", "פוקצ׳ה", "פוקצה", "באגט", "מחמצת", "חלה",
    "פיתה", "פיתות", "לאפה", "טורטייה", "בורקס", "בורקאס", "פיצה",
    "קיש", "מאפין", "מאפינס", "ג׳חנון", "ג'חנון", "מלאווח", "שמרים",
  ],
  veggie: [
    "salad", "salads", "vegetable", "vegetables", "veggie", "veggies",
    "vegan", "vegetarian", "tofu", "tempeh", "seitan", "lentil", "lentils",
    "chickpea", "chickpeas", "hummus", "falafel", "bean", "beans",
    "quinoa", "kale", "spinach", "broccoli", "cauliflower", "zucchini",
    "eggplant", "aubergine", "tomato", "tomatoes", "cucumber", "avocado",
    "mushroom", "mushrooms", "pepper", "peppers", "carrot", "carrots",
    "beet", "beets", "cabbage", "coleslaw", "tabbouleh", "ratatouille",
    "סלט", "סלטים", "ירקות", "ירק", "טבעוני", "טבעונית", "צמחוני",
    "צמחונית", "טופו", "עדשים", "חומוס", "פלאפל", "שעועית", "קינואה",
    "תרד", "ברוקולי", "כרובית", "קישוא", "קישואים", "חציל", "חצילים",
    "עגבניות", "עגבנייה", "מלפפון", "אבוקדו", "פטריות", "גזר", "סלק",
    "כרוב", "טבולה", "רטטוי",
  ],
};

const HEBREW = /[֐-׿]/;

// Latin keywords need real word boundaries so "pie" doesn't match "piece" and
// "bean" doesn't match "beanie". Written as explicit `(^|[^a-z])` /
// `([^a-z]|$)` guards rather than lookbehind, which older Safari can't even
// parse — a SyntaxError in a regex literal takes down the whole module, not
// just the one match.
//
// Hebrew keywords deliberately use plain substring matching instead: Hebrew
// glues its definite article and prepositions onto the front of a word
// (סלט → הסלט, בסלט, לסלט), so a boundary check would miss the majority of
// real-world occurrences.
function matches(haystack: string, keyword: string): boolean {
  if (HEBREW.test(keyword)) return haystack.includes(keyword);
  return new RegExp(`(^|[^a-z])${escapeRegExp(keyword)}([^a-z]|$)`, "i").test(haystack);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface CategorizeInput {
  title: string | null | undefined;
  /** schema.org `recipeCuisine`, when the source page published one. Often
   *  carries a usable hint ("Dessert", "Seafood") even though it's nominally
   *  a cuisine field. */
  cuisine?: string | null;
  /** Optional extra signal — ingredient lines, for callers that have them.
   *  The home page doesn't fetch ingredient text, so it just passes the title. */
  extra?: string[];
}

/**
 * Classify a recipe into one of the six category buckets.
 *
 * Scores every category by how many distinct keywords it matches (rather than
 * first-match-wins) so a title like "Beef Wellington" — which hits both `meat`
 * and `pastry` — is decided by weight of evidence, falling back to TIE_BREAK
 * when the counts are level. Anything that matches nothing is "general".
 */
export function categorizeRecipe(input: CategorizeInput): RecipeCategory {
  const haystack = [input.title ?? "", input.cuisine ?? "", ...(input.extra ?? [])]
    .join(" \n ")
    .toLowerCase();
  if (!haystack.trim()) return "general";

  let best: RecipeCategory = "general";
  let bestScore = 0;

  for (const category of TIE_BREAK) {
    let score = 0;
    for (const keyword of KEYWORDS[category as Exclude<RecipeCategory, "general">]) {
      if (matches(haystack, keyword)) score += 1;
    }
    // Strictly-greater keeps TIE_BREAK's ordering authoritative on ties,
    // since we iterate in that order.
    if (score > bestScore) {
      bestScore = score;
      best = category;
    }
  }

  return best;
}
