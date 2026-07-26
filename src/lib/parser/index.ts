import * as cheerio from "cheerio";
import { detectLang, type Lang } from "../lang";
import { detectTimerSeconds } from "../timers";
import type { ParsedRecipe, SourceType } from "../types";
import { extractArticleText } from "./articleText";
import { extractSocialCaption } from "./caption";
import { extractRecipeFromHtml, type JsonLdRecipe } from "./jsonld";
import { extractRecipeFromText, type LlmRecipe } from "./llm";
import { classifyStepKind } from "./stepKind";
import { splitFreeText } from "./text";
import { cleanTitle, pickTitle } from "./title";

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

// Social platforms serve two different pages depending on who's asking. To a
// generic client — including the polite custom bot UA this used to send —
// Instagram returns a login wall whose og:title is literally "Instagram" and
// whose og:description is empty. That, not the parser, is why saved reels
// came back with zero ingredients.
//
// To a link-preview crawler it serves the real Open Graph tags, caption and
// all, because that's what makes a shared link render a preview in Messenger
// or WhatsApp. Announcing ourselves as one is the supported way to read a
// public post's caption without an API token, and it's the same request every
// chat app makes when the user shares the link. Verified against a real reel
// on 2026-07-26: `facebookexternalhit` returns the full caption, our own UA
// returns nothing.
//
// Kept to the platforms that need it — ordinary recipe blogs get the honest
// UA, and some of them serve crawlers a stripped page.
const CRAWLER_UA = "facebookexternalhit/1.1 (+https://subarashii.app)";
const DEFAULT_UA =
  "Mozilla/5.0 (compatible; SubarashiiBot/1.0; +https://subarashii.app)";

function userAgentFor(sourceType: SourceType): string {
  return sourceType === "instagram" || sourceType === "tiktok"
    ? CRAWLER_UA
    : DEFAULT_UA;
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
    kind: classifyStepKind(text),
  }));

  return {
    // Even structured JSON-LD titles carry site attribution
    // ("Crème Brûlée | Some Food Blog"), so they go through the same cleaner.
    title: cleanTitle(jr.title) ?? "Saved recipe",
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

// The Open Graph metadata a page exposes, read once so the fetch-retry loop
// and the fallback parser can both look at it without re-parsing the document.
interface PageMeta {
  ogTitle: string | undefined;
  descriptions: (string | undefined)[];
  image: string | null;
}

function readMeta($: cheerio.CheerioAPI): PageMeta {
  return {
    ogTitle: $('meta[property="og:title"]').attr("content"),
    descriptions: [
      $('meta[property="og:description"]').attr("content"),
      $('meta[name="twitter:description"]').attr("content"),
      $('meta[name="description"]').attr("content"),
    ],
    image:
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      null,
  };
}

// Fallback when a page has no structured recipe data. Two sources of prose,
// tried in order:
//   1. A social caption in the OG tags — for a reel, the recipe IS the caption.
//   2. The page's own body text — for a blog with no JSON-LD and no useful
//      og:description, the recipe is sitting in the article and nothing else
//      in this file was ever reading it.
// Either way the prose goes to the LLM. If both come up empty we still keep
// title + image and flag for review, so the link is never lost.
async function ogFallback($: cheerio.CheerioAPI, url: string): Promise<ParsedRecipe> {
  const meta = readMeta($);
  // Candidates in descending trustworthiness. The description entries matter
  // most for social posts: Instagram's og:title is often literally
  // "Instagram" (or a login-wall title) while its og:description still
  // carries the caption — which starts with the dish name. Falling through
  // to the caption is what stops a saved reel from being called "Instagram".
  const title =
    pickTitle([
      meta.ogTitle,
      $('meta[name="twitter:title"]').attr("content"),
      ...meta.descriptions,
      $("h1").first().text(),
      $("title").text(),
    ]) ?? "Saved recipe";

  const sourceType = detectSourceType(url);
  const base: ParsedRecipe = {
    title,
    source_url: url,
    source_type: sourceType,
    cover_image_url: meta.image,
    servings: null,
    total_time_min: null,
    cuisine: null,
    primary_language: null,
    ingredients: [],
    steps: [],
    needs_review: true,
    raw_capture: url,
  };

  // `extractArticleText` strips chrome elements out of the document, so all
  // metadata reads have to happen before it runs. They do — `meta` and `title`
  // above are both resolved by this point.
  const prose = extractSocialCaption(meta.ogTitle, ...meta.descriptions) ?? extractArticleText($);
  if (!prose) return base;

  // Keep the prose regardless of whether extraction works — if the model is
  // unavailable or gets it wrong, the raw text is still there to read and to
  // re-run against later.
  base.raw_capture = prose;

  const llm = await extractRecipeFromText(prose);
  if (!llm) return base;
  return applyLlmRecipe(base, llm, prose);
}

// Merge an LLM extraction onto a draft, preferring extracted values but never
// letting a missing one blank out something the page already told us.
function applyLlmRecipe(
  base: ParsedRecipe,
  llm: LlmRecipe,
  fallbackLangSource: string,
): ParsedRecipe {
  const ingredients = llm.ingredients.map((raw_text) => ({
    raw_text,
    language: detectLang(raw_text),
  }));
  const steps = llm.steps.map((text) => ({
    text,
    detected_timer_seconds: detectTimerSeconds(text),
    kind: classifyStepKind(text),
  }));

  return {
    ...base,
    title: cleanTitle(llm.title) ?? base.title,
    servings: llm.servings ?? base.servings,
    total_time_min: llm.total_time_min ?? base.total_time_min,
    cuisine: llm.cuisine ?? base.cuisine,
    primary_language:
      majorityLang([
        ...ingredients.map((i) => i.raw_text),
        ...steps.map((s) => s.text),
      ]) ?? majorityLang([fallbackLangSource]),
    ingredients,
    steps,
    needs_review: ingredients.length === 0 || steps.length === 0,
  };
}

// Turn free-form text (OCR / caption / paste) into a recipe draft.
//
// Tries the LLM first and only falls back to the line-shape heuristics when
// it's unavailable or unhelpful — pasted recipe text is prose far more often
// than it's a tidy list, and that's exactly the case the heuristics lose.
export async function parseFromText(
  text: string,
  sourceType: SourceType = "screenshot",
): Promise<ParsedRecipe> {
  const llm = await extractRecipeFromText(text);
  if (llm) {
    return applyLlmRecipe(heuristicFromText(text, sourceType), llm, text);
  }
  return heuristicFromText(text, sourceType);
}

// Also used directly by callers that already have an LLM result and just want
// the same draft shape to merge onto.
export function heuristicFromText(
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
    kind: classifyStepKind(t),
  }));

  return {
    title: cleanTitle(split.title) ?? "Saved recipe",
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

const FETCH_TIMEOUT_MS = 10_000;

// Instagram does not reliably serve the caption even to a crawler UA. The same
// reel URL, fetched twice minutes apart, produced a full Hebrew caption once
// and a bare login wall the other time — same code, same headers. It's rate
// limiting / load shedding on their side, not something the request can be
// shaped around, so the only fix is to ask again.
//
// Three attempts with a short backoff. Kept small deliberately: this runs
// inside a Server Action the user is waiting on, and past ~3 tries a failure
// is much more likely to be a genuinely private post than a flaky response.
const SOCIAL_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = 600;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url: string, userAgent: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // A retry against a CDN that just handed us a login wall is pointless if
      // the runtime serves it back out of cache.
      cache: "no-store",
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
      },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Fetch a URL and extract a recipe. Never throws — returns a review stub on
// any failure so a saved link is never lost.
export async function parseFromUrl(url: string): Promise<ParsedRecipe> {
  try {
    const sourceType = detectSourceType(url);
    const isSocial = sourceType === "instagram" || sourceType === "tiktok";
    const attempts = isSocial ? SOCIAL_ATTEMPTS : 1;

    // Holds the best response seen so far. A login wall still carries a usable
    // og:image and source URL, so it's kept as a floor while we retry — better
    // to save a thin recipe than to lose the link to a stub.
    let html: string | null = null;

    for (let attempt = 0; attempt < attempts; attempt++) {
      if (attempt > 0) await sleep(RETRY_BACKOFF_MS * attempt);

      const candidate = await fetchHtml(url, userAgentFor(sourceType));
      if (!candidate) continue;
      html ??= candidate;

      // Anything with real recipe content ends the loop immediately. For a
      // non-social page there's only ever one attempt anyway.
      if (!isSocial || hasUsableContent(candidate)) {
        html = candidate;
        break;
      }
    }

    if (!html) return stub(url);

    const jr = extractRecipeFromHtml(html);
    if (jr && jr.ingredients.length > 0) return fromJsonLd(jr, url);
    return await ogFallback(cheerio.load(html), url);
  } catch {
    return stub(url);
  }
}

// Did this response actually contain the post, or is it the login wall? Judged
// by whether there's a caption to extract, since that's the one thing the
// whole social path depends on.
function hasUsableContent(html: string): boolean {
  try {
    const $ = cheerio.load(html);
    if (extractRecipeFromHtml(html)?.ingredients.length) return true;
    const meta = readMeta($);
    return extractSocialCaption(meta.ogTitle, ...meta.descriptions) !== null;
  } catch {
    return false;
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
