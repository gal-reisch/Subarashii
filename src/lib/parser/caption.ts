// Pull the author's caption body out of a social platform's Open Graph tags.
//
// Instagram/TikTok/Threads all wrap the caption in an attribution sentence:
//   og:description → `5,914 likes, 148 comments - danitsofer on July 4, 2024: "…caption…"`
//   og:title       → `danitsofer on Instagram: "…caption…"`
// In both cases everything up to and including the first `: "` is chrome and
// the caption is the quoted remainder — which, for a recipe post, is the
// whole recipe.
//
// Related but different from `title.ts`'s handling of the same wrapper:
// `cleanTitle` unwraps it and then keeps only the FIRST LINE (the dish name).
// Here we want the opposite — the entire multi-line body, newlines intact,
// because the line structure is what separates ingredients from steps.

// Colon followed by an opening quote. Requiring the quote is what keeps this
// from firing on an ordinary description containing a colon.
const WRAPPER = /:\s*["“„«»]/;

// Leftover closing quote / sentence punctuation / bidi marks at the very end.
const TRAILING = /[\s".,'”“„«»‎‏]+$/u;

// A trailing wall of hashtags. Instagram captions routinely end with 20+ of
// them, and while the extraction prompt is told to ignore hashtags, dropping
// them here keeps them out of the heuristic fallback path too (which would
// otherwise file every one as a short, period-less "ingredient").
const HASHTAG_BLOCK = /(?:^|\n)(?:[\s‎‏]*#[^\s#]+[\s‎‏]*)+$/u;

/**
 * Returns the caption body, or null when the metadata carries no caption
 * (a login wall, or a non-social page).
 */
export function extractSocialCaption(
  ...candidates: (string | null | undefined)[]
): string | null {
  for (const raw of candidates) {
    if (!raw) continue;
    const text = raw.replace(/\r\n?/g, "\n");
    const m = text.match(WRAPPER);
    if (!m || m.index == null) continue;

    let body = text.slice(m.index + m[0].length);
    body = body.replace(HASHTAG_BLOCK, "").replace(TRAILING, "").trim();
    // Anything this short is a one-liner caption, not a recipe.
    if (body.length < 40) continue;
    return body;
  }
  return null;
}
