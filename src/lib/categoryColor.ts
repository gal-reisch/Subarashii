// Deterministic mapping from a recipe's free-text `cuisine` field to one of
// 6 decorative "category" colors (task #24) used to skin the recipe card
// (body background behind the diagonal photo notch, category label/title
// color, footer stat pill). This is
// purely decorative/organizational — NOT the same system as the nutrition
// chips' protein/fat/sugar/fiber colors (--cat-*-bg/-text tokens), which
// have a fixed nutrient-type meaning and must never be touched here.
//
// `cuisine` is unbounded free text (sourced from parsed recipe JSON-LD), so
// coverage has to be total: a small curated lookup handles common cuisines
// with an intuitive color, and everything else (including null/unknown
// strings) falls through to a stable hash so the same cuisine always lands
// on the same category.

export type RecipeCategory = "teal" | "rust" | "purple" | "olive" | "blue" | "amber";

const CATEGORIES: RecipeCategory[] = ["teal", "rust", "purple", "olive", "blue", "amber"];

// Cosmetic nicety, not derived from Figma — safe to trim if it feels
// arbitrary. Anything not listed here still gets a category via the hash
// fallback below, so this table is an enhancement, not a requirement.
const CUISINE_OVERRIDES: Partial<Record<string, RecipeCategory>> = {
  italian: "rust",
  mexican: "amber",
  japanese: "blue",
  chinese: "rust",
  indian: "amber",
  french: "purple",
  thai: "olive",
  mediterranean: "teal",
  american: "olive",
  korean: "blue",
  vietnamese: "teal",
  greek: "purple",
};

// djb2-ish string hash — deterministic, dependency-free, stable across
// server and client renders (same string always produces the same number).
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Null/empty cuisine gets a fixed "olive" bucket rather than being hashed —
// an arbitrary but deterministic choice so uncategorized recipes are
// visually consistent with each other rather than scattered.
export function categoryForCuisine(cuisine: string | null | undefined): RecipeCategory {
  const key = (cuisine ?? "").trim().toLowerCase();
  if (!key) return "olive";
  return CUISINE_OVERRIDES[key] ?? CATEGORIES[hashString(key) % CATEGORIES.length];
}

// Complete, literal Tailwind class strings per category — never assemble
// these via template-string interpolation at a call site. Tailwind v4 has
// no `tailwind.config` content array in this repo (it scans source files
// for whole class-name tokens), so a dynamically-built class name like
// `bg-recipe-cat-${cat}-light` would silently fail to generate any CSS.
export interface CategoryStyle {
  /** Card body background (category's "light" tone). */
  cardBg: string;
  /** Category label text color (category's "dark" tone). */
  labelText: string;
  /** Recipe title text color (category's "dark" tone). */
  titleText: string;
  /** Footer stat pill background (category's "mid" tone). */
  pillBg: string;
  /** Footer stat pill text (category's "pale" tone). */
  pillText: string;
}

export const CATEGORY_STYLES: Record<RecipeCategory, CategoryStyle> = {
  teal: {
    cardBg: "bg-recipe-cat-teal-light",
    labelText: "text-recipe-cat-teal-dark",
    titleText: "text-recipe-cat-teal-dark",
    pillBg: "bg-recipe-cat-teal-mid",
    pillText: "text-recipe-cat-teal-pale",
  },
  rust: {
    cardBg: "bg-recipe-cat-rust-light",
    labelText: "text-recipe-cat-rust-dark",
    titleText: "text-recipe-cat-rust-dark",
    pillBg: "bg-recipe-cat-rust-mid",
    pillText: "text-recipe-cat-rust-pale",
  },
  purple: {
    cardBg: "bg-recipe-cat-purple-light",
    labelText: "text-recipe-cat-purple-dark",
    titleText: "text-recipe-cat-purple-dark",
    pillBg: "bg-recipe-cat-purple-mid",
    pillText: "text-recipe-cat-purple-pale",
  },
  olive: {
    cardBg: "bg-recipe-cat-olive-light",
    labelText: "text-recipe-cat-olive-dark",
    titleText: "text-recipe-cat-olive-dark",
    pillBg: "bg-recipe-cat-olive-mid",
    pillText: "text-recipe-cat-olive-pale",
  },
  blue: {
    cardBg: "bg-recipe-cat-blue-light",
    labelText: "text-recipe-cat-blue-dark",
    titleText: "text-recipe-cat-blue-dark",
    pillBg: "bg-recipe-cat-blue-mid",
    pillText: "text-recipe-cat-blue-pale",
  },
  amber: {
    cardBg: "bg-recipe-cat-amber-light",
    labelText: "text-recipe-cat-amber-dark",
    titleText: "text-recipe-cat-amber-dark",
    pillBg: "bg-recipe-cat-amber-mid",
    pillText: "text-recipe-cat-amber-pale",
  },
};
