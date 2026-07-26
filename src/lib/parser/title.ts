// Recipe title extraction and cleanup.
//
// The naive "use og:title, else <title>" approach produces titles like
// "Instagram" — because that IS what Instagram puts in those tags for a
// post that a bot can't see past the login wall. Blog recipes have a milder
// version of the same problem ("Best Crème Brûlée | Some Food Blog").
//
// This module does two things:
//   1. `cleanTitle` — normalizes one candidate string and returns null if it
//      turns out to be a site name / boilerplate rather than a real title.
//   2. `pickTitle` — tries several candidates in priority order and returns
//      the first that survives, so a caller can fall back from og:title to
//      the post caption instead of settling for "Instagram".

// Page/site names and boilerplate that are never a recipe title. Matched
// against the whole cleaned string (case-insensitive), not as a substring —
// "Instagram Famous Banana Bread" is a perfectly good title.
const JUNK_TITLES = new Set([
  "instagram",
  "tiktok",
  "facebook",
  "pinterest",
  "youtube",
  "twitter",
  "threads",
  "reels",
  "reel",
  "video",
  "watch",
  "photo",
  "post",
  "home",
  "login",
  "log in",
  "sign up",
  "untitled",
  "recipe",
  "recipes",
  "saved recipe",
  "page not found",
  "404",
  "404 not found",
  "access denied",
  "just a moment...",
  "just a moment",
  "attention required!",
  "are you a robot?",
]);

// Social platforms put the real caption after a colon:
//   og:title       → `username on Instagram: "actual caption"`
//   og:description → `1,234 likes, 56 comments - username on January 1, 2025: "actual caption"`
// Both collapse to "…on <platform>…: <caption>", so one pattern covers them.
// `og:title` form — the platform is named right before the colon:
//   `username on Instagram: "actual caption"`
const SOCIAL_CAPTION =
  /\bon\s+(?:instagram|tiktok|facebook|threads)\b[^:]*:\s*(.+)/i;

// `og:description` form — same shape, but the platform name is replaced by a
// date, so there's nothing to key off except the quoted caption itself:
//   `1,234 likes, 56 comments - username on January 1, 2025: "actual caption"`
// Requiring an actual quote character right after the colon keeps this from
// firing on ordinary titles that happen to contain one ("Dinner: The Best
// Roast Chicken").
const SOCIAL_QUOTED = /:\s*["“„«»](.+)/;

// Trailing site-name attribution. Deliberately limited to `|`, `·` and `•`,
// which are almost exclusively used as site separators. Dashes are NOT
// stripped: real recipe titles use them constantly ("Slow-Cooked Short Ribs
// - Two Ways", and Hebrew titles routinely use " - " mid-phrase).
const SITE_SUFFIX = /\s*[|·•]\s*[^|·•]{2,45}$/u;

// Leading editorial labels that publishers bolt onto a headline, which are
// framing rather than part of the dish name. The user's example: the blog
// headline "המדריך: תבשיל אסאדו בבצלים וסילאן" — "המדריך" ("the guide")
// says nothing about what's being cooked, and the recipe should just be
// called "תבשיל אסאדו בבצלים וסילאן".
//
// Deliberately a closed list rather than a general "strip anything before a
// colon" rule, which would wreck real titles that use a colon structurally
// ("Dinner: The Best Roast Chicken", "שבת: חמין קלאסי"). Only these exact
// words, only as the entire leading segment, only when something substantial
// remains after them.
const LEADING_LABELS = [
  // Hebrew
  "המדריך",
  "מדריך",
  "המתכון",
  "מתכון",
  "הסוד",
  "טיפ",
  "הטיפ",
  "כתבה",
  "סרטון",
  "חדש",
  "בלעדי",
  "מומלץ",
  // English
  "recipe",
  "the recipe",
  "guide",
  "the guide",
  "how to",
  "how to make",
  "tutorial",
  "video",
  "watch",
  "new",
  "exclusive",
  "must try",
  "must-try",
];

const LEADING_LABEL_RE = new RegExp(
  `^(?:${LEADING_LABELS.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*[:：]\\s*`,
  "iu",
);

/** Strip one leading editorial label ("Recipe: X", "המדריך: X"). Applied once
 *  rather than in a loop — a title with two stacked labels is vanishingly
 *  rare, and looping risks eating a real title word by word. */
function stripLeadingLabel(t: string): string {
  const stripped = t.replace(LEADING_LABEL_RE, "").trim();
  // Never let the strip leave a stub; if what remains is too short to be a
  // dish name, the label was probably doing real work.
  return stripped.length >= 3 ? stripped : t;
}

// First sentence boundary, used only for captions (which are prose, so the
// dish name is the opening sentence and the rest is chatter).
const SENTENCE_END = /^(.+?[.!?])\s+\p{L}/u;

const QUOTE_CHARS = "\"'“”„«»‘’";

function unquote(s: string): string {
  const cls = `[${QUOTE_CHARS}\\s]+`;
  return s.replace(new RegExp(`^${cls}`), "").replace(new RegExp(`${cls}$`), "");
}

/**
 * Normalize a single title candidate. Returns null when the candidate is
 * boilerplate (a site name, a login page, an empty string) and the caller
 * should try the next candidate instead.
 */
export function cleanTitle(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Normalize line endings but do NOT collapse whitespace yet — the line
  // structure is load-bearing below, and flattening it first would let a
  // caption's second line bleed into the title.
  let t = raw.replace(/\r\n?/g, "\n").trim();
  if (!t) return null;

  // Pull the caption out of a social-platform title/description wrapper.
  const social = t.match(SOCIAL_CAPTION) ?? t.match(SOCIAL_QUOTED);
  const fromCaption = social !== null;
  if (social) t = social[1];

  // Captions are whole paragraphs: keep only the first line, which is where
  // the dish name almost always lives. Safe to collapse whitespace now.
  t = unquote(t.split("\n")[0]).replace(/\s+/g, " ").trim();

  // Drop a trailing " | Site Name" attribution, but never if that would
  // leave us with almost nothing.
  const stripped = t.replace(SITE_SUFFIX, "").trim();
  if (stripped.length >= 3) t = stripped;

  // Drop a leading editorial label ("המדריך: …", "Recipe: …"). Done after the
  // site-suffix strip so "Recipe: X | Some Blog" loses both, and before the
  // final unquote so a label sitting inside quotes still gets caught.
  t = stripLeadingLabel(t);

  t = unquote(t).trim();

  // A caption's first line is still prose — "Best Banana Bread ever. Recipe
  // below!" — so keep just the opening sentence. Only done for captions;
  // an ordinary page title is already a title and shouldn't be truncated.
  if (fromCaption) {
    const sentence = t.match(SENTENCE_END);
    if (sentence && sentence[1].length >= 3) t = sentence[1].trim();
  }

  // Still paragraph-length? Cut at the first sentence/clause boundary rather
  // than hard-truncating mid-word.
  if (t.length > 90) {
    const cut = t.slice(0, 90);
    const boundary = Math.max(
      cut.lastIndexOf(". "),
      cut.lastIndexOf("! "),
      cut.lastIndexOf("? "),
      cut.lastIndexOf(", "),
      cut.lastIndexOf(" - "),
    );
    t = (boundary > 20 ? cut.slice(0, boundary) : cut.replace(/\s+\S*$/, "")).trim();
  }

  // Trailing punctuation left over from a mid-sentence cut.
  t = t.replace(/[\s.,;:–—-]+$/u, "").trim();

  if (t.length < 2) return null;
  if (JUNK_TITLES.has(t.toLowerCase())) return null;
  // A "title" that's only digits/punctuation (view counts, dates) isn't one.
  if (!/[\p{L}]/u.test(t)) return null;

  return t;
}

/**
 * Try each candidate in order and return the first that cleans up into a
 * usable title, or null if none do.
 */
export function pickTitle(candidates: (string | null | undefined)[]): string | null {
  for (const c of candidates) {
    const cleaned = cleanTitle(c);
    if (cleaned) return cleaned;
  }
  return null;
}
