import * as cheerio from "cheerio";
import { detectLang, type Lang } from "../lang";
import { detectTimerSeconds } from "../timers";
import type { ParsedRecipe, SourceType } from "../types";
import { extractRecipeFromHtml, type JsonLdRecipe } from "./jsonld";
import { splitFreeText } from "./text";

function detectSourceType(url: string): SourceType {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("instagram.com")) return "instagram";
    if (host.includes("tiktok.com")) return "tiktok";
    return "blog";
  } catch {
    return "other";
  }
}

function majorityLang(texts: string[]): Lang | null {
  if (texts.length === 0) return null;
  let he = 0;
  let en = 0;
  for (const t of texts) (detectLang(t) === "he" ? he++ : en++);
  return he >= en && he > 0 ? "he" : "en";
}

function fromJsonLd(jr: JsonLdRecipe, url: string | null): ParsedRecipe {
  const ingredients = jr.ingredients.map((raw_text) => ({
    raw_text,
    language: detectLang(raw_text),
  }));
  const steps = jr.steps.map((text) => ({
    text,
    detected_timer_seconds: detectTimerSeconds(text),
  }));

  return {
    title: jr.title || "Saved recipe",
    source_url: url,
    source_type: url ? detectSourceType(url) : "other",
    cover_image_url: jr.image,
    servings: jr.servings,
    total_time_min: jr.totalTimeMin,
    cuisine: jr.cuisine,
    primary_language: majorityLang([
      ...ingredients.map((i) => i.raw_text),
      ...steps.map((s) => s.text),
    ]),
    ingredients,
    steps,
    needs_review: ingredients.length === 0 || steps.length === 0,
    raw_capture: null,
  };
}

// Fallback when a page has no structured recipe data: keep title + image and
// flag for review so the link is never lost.
function ogFallback(html: string, url: string): ParsedRecipe {
  const $ = cheerio.load(html);
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("title").text().trim() ||
    "Saved recipe";
  const image =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    null;

  return {
    title,
    source_url: url,
    source_type: detectSourceType(url),
    cover_image_url: image,
    servings: null,
    total_time_min: null,
    cuisine: null,
    primary_language: null,
    ingredients: [],
    steps: [],
    needs_review: true,
    raw_capture: url,
  };
}

// Turn free-form text (OCR / caption / paste) into a recipe draft.
export function parseFromText(
  text: string,
  sourceType: SourceType = "screenshot",
): ParsedRecipe {
  const split = splitFreeText(text);
  const ingredients = split.ingredients.map((raw_text) => ({
    raw_text,
    language: detectLang(raw_text),
  }));
  const steps = split.steps.map((t) => ({
    text: t,
    detected_timer_seconds: detectTimerSeconds(t),
  }));

  return {
    title: split.title,
    source_url: null,
    source_type: sourceType,
    cover_image_url: null,
    servings: null,
    total_time_min: null,
    cuisine: null,
    primary_language: majorityLang([text]),
    ingredients,
    steps,
    needs_review: ingredients.length === 0 || steps.length === 0,
    raw_capture: text,
  };
}

// Fetch a URL and extract a recipe. Never throws — returns a review stub on
// any failure so a saved link is never lost.
export async function parseFromUrl(url: string): Promise<ParsedRecipe> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SubarashiiBot/1.0; +https://subarashii.app)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) return stub(url);
    const html = await res.text();

    const jr = extractRecipeFromHtml(html);
    if (jr && jr.ingredients.length > 0) return fromJsonLd(jr, url);
    return ogFallback(html, url);
  } catch {
    return stub(url);
  }
}

function stub(url: string): ParsedRecipe {
  return {
    title: "Saved recipe",
    source_url: url,
    source_type: detectSourceType(url),
    cover_image_url: null,
    servings: null,
    total_time_min: null,
    cuisine: null,
    primary_language: null,
    ingredients: [],
    steps: [],
    needs_review: true,
    raw_capture: url,
  };
}

// Detect whether a shared string is a URL or free text, and parse accordingly.
export async function parseInput(input: {
  url?: string | null;
  text?: string | null;
}): Promise<ParsedRecipe> {
  const url = input.url?.trim();
  if (url && /^https?:\/\//i.test(url)) return parseFromUrl(url);

  const text = input.text?.trim();
  if (text) {
    // A bare URL pasted as text.
    if (/^https?:\/\/\S+$/i.test(text)) return parseFromUrl(text);
    return parseFromText(text);
  }
  return stub(url || "");
}
