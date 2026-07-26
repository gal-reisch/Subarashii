import * as cheerio from "cheerio";
import { isoDurationToMinutes, parseServings } from "./duration";
import { mergeUnclosedParenStrings } from "./mergeSteps";

export interface JsonLdRecipe {
  title: string | null;
  image: string | null;
  servings: number | null;
  totalTimeMin: number | null;
  cuisine: string | null;
  author: string | null;
  ingredients: string[];
  steps: string[];
}

type Json = Record<string, unknown>;

function typeMatches(node: Json, wanted: string): boolean {
  const t = node["@type"];
  if (typeof t === "string") return t === wanted;
  if (Array.isArray(t)) return t.includes(wanted);
  return false;
}

// Flatten every JSON-LD node (including @graph containers) into a flat list.
function collectNodes(data: unknown, out: Json[]): void {
  if (!data) return;
  if (Array.isArray(data)) {
    data.forEach((d) => collectNodes(d, out));
    return;
  }
  if (typeof data === "object") {
    const node = data as Json;
    out.push(node);
    if (Array.isArray(node["@graph"])) collectNodes(node["@graph"], out);
  }
}

// schema.org `author` is either a string, a Person/Organization object with a
// `name`, or an array of those — sites use all three. Only the name is wanted;
// the rest of a Person node is a URL and a photo the card has no room for.
//
// The first entry wins on an array. Multi-author recipes exist, but the card
// has one line for this and "Alice Smith and 3 others" is worse than "Alice
// Smith" — the detail page links to the source for anyone who cares.
const MAX_AUTHOR_LEN = 60;

function parseAuthor(author: unknown): string | null {
  const first = Array.isArray(author) ? author[0] : author;
  if (!first) return null;

  const name =
    typeof first === "string"
      ? first
      : typeof first === "object" && typeof (first as Json).name === "string"
        ? ((first as Json).name as string)
        : null;
  if (!name) return null;

  const clean = inlineText(name).trim();
  // A few CMSs emit the site's own name here, or a whole bio paragraph.
  // Neither is a byline, and both would push the title off the card.
  if (!clean || clean.length > MAX_AUTHOR_LEN) return null;
  return clean;
}

function parseImage(img: unknown): string | null {
  if (!img) return null;
  if (typeof img === "string") return img;
  if (Array.isArray(img)) return parseImage(img[0]);
  if (typeof img === "object") {
    const url = (img as Json).url;
    return typeof url === "string" ? url : null;
  }
  return null;
}

// Decode HTML entities (&#8211; &nbsp; &amp; …) and strip stray tags that
// recipe plugins often bake into JSON-LD text fields. Returns one clean line.
function inlineText(raw: string): string {
  if (!raw) return "";
  const text = cheerio.load(`<div>${raw}</div>`)("div").text();
  return text.replace(/\s+/g, " ").trim();
}

// A single instruction blob (one long string) → discrete steps. Splits on
// block boundaries and sentence ends, for both English and Hebrew prose.
function splitInstructionString(raw: string): string[] {
  const withBreaks = raw
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6])>/gi, "\n");
  const text = cheerio.load(`<div>${withBreaks}</div>`)("div").text();
  const parts = text
    // Split on real line breaks, or "end-of-sentence + space + next word".
    // Requiring a following letter avoids breaking decimals like "1.5".
    .split(/\r?\n+|(?<=[.!?])\s+(?=[\p{L}])/u)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  // Re-join fragments that were split inside an unclosed parenthesis. See
  // `mergeSteps.ts` — the same rule runs again at render time over stored
  // rows, so recipes saved before this fix get repaired too.
  return mergeUnclosedParenStrings(parts);
}

function parseInstructions(ri: unknown): string[] {
  if (!ri) return [];
  // A single string blob: split it into steps.
  if (typeof ri === "string") {
    return splitInstructionString(ri);
  }
  if (Array.isArray(ri)) {
    const steps: string[] = [];
    for (const item of ri) {
      // An array implies pre-structured steps — keep each element as one step.
      if (typeof item === "string") {
        const clean = inlineText(item);
        if (clean) steps.push(clean);
      } else if (item && typeof item === "object") {
        const node = item as Json;
        if (typeMatches(node, "HowToSection") && Array.isArray(node.itemListElement)) {
          for (const s of node.itemListElement) {
            if (typeof s === "string") steps.push(inlineText(s));
            else if (s && typeof s === "object") {
              const sn = s as Json;
              const text = (sn.text || sn.name) as string | undefined;
              if (text) steps.push(inlineText(text));
            }
          }
        } else {
          const text = (node.text || node.name) as string | undefined;
          if (text) steps.push(inlineText(text));
        }
      }
    }
    return steps.filter(Boolean);
  }
  return [];
}

function parseIngredients(ri: unknown): string[] {
  if (Array.isArray(ri)) {
    return ri.map((x) => inlineText(String(x))).filter(Boolean);
  }
  if (typeof ri === "string") {
    return ri
      .split(/\r?\n/)
      .map((s) => inlineText(s))
      .filter(Boolean);
  }
  return [];
}

// Extract a schema.org/Recipe from a page's HTML. Returns null if none found.
export function extractRecipeFromHtml(html: string): JsonLdRecipe | null {
  const $ = cheerio.load(html);
  const nodes: Json[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    try {
      collectNodes(JSON.parse(raw), nodes);
    } catch {
      // Some sites embed multiple/looser JSON blocks; skip unparseable ones.
    }
  });

  const recipe = nodes.find((n) => typeMatches(n, "Recipe"));
  if (!recipe) return null;

  const totalTime =
    isoDurationToMinutes(recipe.totalTime as string) ??
    isoDurationToMinutes(recipe.cookTime as string);

  const cuisineRaw = recipe.recipeCuisine;
  const cuisine = Array.isArray(cuisineRaw)
    ? String(cuisineRaw[0] ?? "") || null
    : (cuisineRaw as string) || null;

  return {
    title: inlineText((recipe.name as string) ?? "") || null,
    image: parseImage(recipe.image),
    servings: parseServings(recipe.recipeYield),
    totalTimeMin: totalTime,
    cuisine,
    author: parseAuthor(recipe.author),
    ingredients: parseIngredients(recipe.recipeIngredient ?? recipe.ingredients),
    steps: parseInstructions(recipe.recipeInstructions),
  };
}
