// Pull the readable body text out of an ordinary web page.
//
// Why this exists: a recipe blog that publishes no JSON-LD and no og:description
// used to fall all the way through to a bare stub — title + image, zero
// ingredients, flagged for review. The recipe was right there in the page body;
// nothing was ever looking at it. `thekitchencoach.co.il` is the case that
// prompted this: valid HTML, real recipe, no structured data anywhere.
//
// This is deliberately NOT a full readability implementation. The consumer is
// the LLM extractor, which is perfectly happy to skim past a nav menu or a
// "you might also like" block. So the job here is only to (a) drop the parts
// that are definitely not prose — scripts, styles, chrome — and (b) preserve
// LINE STRUCTURE, because a one-per-line ingredient list is the single
// strongest signal in the whole page and `.text()` on a container flattens it
// into an unreadable run-on.

import type { CheerioAPI } from "cheerio";

// Removed outright: never contains recipe prose, frequently contains enough
// text to drown it out.
const STRIP =
  "script, style, noscript, template, svg, iframe, nav, header, footer, aside, form, button, select, textarea";

// Containers a CMS is likely to put the article in, best first. Falling back
// to <main> and then <body> means this always returns something.
const ROOTS = [
  "article",
  "[itemprop='articleBody']",
  ".post-content",
  ".entry-content",
  ".article-body",
  ".recipe",
  "main",
  "body",
];

// Block-level elements whose text is worth one line each. `div` is absent on
// purpose: divs nest, so collecting them duplicates every inner paragraph.
const BLOCKS = "p, li, h1, h2, h3, h4, h5, h6, blockquote, dt, dd, td, figcaption";

// Enough context for any recipe, comfortably inside the model's window, and a
// hard cap so a pathological page can't blow up the request.
const MAX_CHARS = 12_000;

// Below this there's nothing for the extractor to work with and the round trip
// isn't worth making.
const MIN_USEFUL = 200;

/**
 * Returns the page's readable text with one line per block element, or null
 * if the page has too little prose to be worth sending anywhere.
 *
 * Takes an already-loaded CheerioAPI rather than an HTML string because the
 * caller has one — parsing the same document twice is pure waste on a page
 * that can be a megabyte of markup.
 *
 * NOTE: mutates the passed document (it strips chrome elements). The caller
 * must have read any `<meta>` tags it needs first — `<head>` is untouched, but
 * relying on that ordering by accident is how this breaks later.
 */
export function extractArticleText($: CheerioAPI): string | null {
  $(STRIP).remove();

  // Plenty of blogs mark up the ingredient list as ONE <p> with <br> between
  // items, and `.text()` drops <br> entirely — the whole list arrives as a
  // single run-on line and the model has to guess where each ingredient ends.
  // It guesses wrong: `1.5 ק"ג אסאדו ... 4-5 בצלים ...` came back as an
  // ingredient literally named `1.5 ק`. Substituting a real newline first is
  // what makes that list parse as a list.
  $("br").replaceWith("\n");

  // ROOTS is ordered narrowest-first, so the first candidate with enough prose
  // wins. `best` only matters when none of them clear the bar, in which case
  // the most text we found anywhere is still better than giving up.
  let best = "";
  for (const selector of ROOTS) {
    const root = $(selector).first();
    if (root.length === 0) continue;

    const lines: string[] = [];
    const seen = new Set<string>();
    root.find(BLOCKS).each((_, el) => {
      const node = $(el);
      // Blocks nest — `<li><p>…</p></li>`, `<td><p>…</p></td>` — and taking
      // both levels emits every line twice. Only leaf blocks are kept.
      if (node.find(BLOCKS).length > 0) return;

      // Collapse runs of spaces/tabs but keep the newlines the <br> pass just
      // introduced, so one block can contribute several lines.
      for (const raw of node.text().split("\n")) {
        const line = raw.replace(/[^\S\n]+/g, " ").trim();
        if (!line) continue;
        // Nav labels, breadcrumbs and "share this" repeat all over a page, and
        // they're all short. Long lines are left alone — a repeat there is much
        // more likely to be real recipe text than boilerplate, and dropping it
        // would silently lose a step.
        if (line.length < 80 && seen.has(line)) continue;
        seen.add(line);
        lines.push(line);
      }
    });

    const text = lines.join("\n");
    if (text.length >= MIN_USEFUL) {
      best = text;
      break;
    }
    if (text.length > best.length) best = text;
  }

  if (best.length < MIN_USEFUL) return null;
  return best.length > MAX_CHARS ? best.slice(0, MAX_CHARS) : best;
}
