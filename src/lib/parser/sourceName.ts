// Where a recipe came from, as a name you'd actually say out loud.
//
// This is the fallback behind the `author` field. The first pass at that field
// only accepted a *person* — a byline, a chef named in the text — and
// explicitly rejected publications and platforms on the grounds that
// "Bon Appétit" is not a human. True, but it meant the line under the title
// was blank for most recipes, which is worse than slightly-wrong attribution:
// the useful question is "where did this come from", not "who typed it".
//
// So when nobody is named, the source answers instead: the Instagram profile
// that posted it, the site that published it. Derived from the page's own
// metadata rather than asked of the model, because the model never sees the
// meta tags or the URL — it only gets the caption text — and because a
// hostname is a fact, not something worth spending an inference on.
//
// The one thing deliberately NOT returned is the bare platform name. "This
// recipe is by Instagram" is noise; "by @sarahcooks" is provenance. Every
// path below rejects the platform's own name explicitly.

/** Platform/junk names that are never a useful attribution on their own. */
const PLATFORM_NAMES = new Set([
  "instagram",
  "tiktok",
  "facebook",
  "youtube",
  "pinterest",
  "twitter",
  "x",
  "threads",
  "login",
  "log in",
  "sign up",
  "home",
  "watch",
  "reels",
]);

const MAX_LEN = 60;

/** True for names that identify a platform rather than a source: "Instagram"
 *  attributes a recipe to nobody. Exported because the LLM extractor needs the
 *  same rule — the prompt asks the model not to answer with one, and this is
 *  the guard for when it does anyway. */
export function isPlatformName(value: string): boolean {
  return PLATFORM_NAMES.has(value.trim().toLowerCase());
}

function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed.length > MAX_LEN) return null;
  if (isPlatformName(trimmed)) return null;
  return trimmed;
}

/**
 * The account behind a social post, read out of its og:title.
 *
 * Instagram and TikTok both put the poster in that tag, in one of a few
 * shapes, and it's the only place a public post reliably names them — the URL
 * of a `/reel/` or `/p/` link contains a shortcode and nothing else.
 *
 *   "Sarah Cohen (@sarahcooks) • Instagram photo"  → Sarah Cohen
 *   "Ottolenghi on Instagram: \"...\""              → Ottolenghi
 *   "@sarahcooks"                                   → @sarahcooks
 *   "Instagram"                    (the login wall) → null
 *
 * The display name is preferred over the handle when both are present, since
 * that's the human-readable half; the handle is the fallback.
 */
export function socialAccountName(ogTitle: string | null | undefined): string | null {
  const title = ogTitle?.replace(/\s+/g, " ").trim();
  if (!title) return null;

  // "Display Name (@handle) • Instagram photo" / "... (@handle) on TikTok"
  const withHandle = title.match(/^(.*?)\s*\(@([A-Za-z0-9._]+)\)/);
  if (withHandle) {
    return clean(withHandle[1]) ?? clean(`@${withHandle[2]}`);
  }

  // "Display Name on Instagram: "caption...""
  const onPlatform = title.match(/^(.*?)\s+on\s+(?:Instagram|TikTok)\b/i);
  if (onPlatform) {
    const name = clean(onPlatform[1]);
    if (name) return name;
  }

  // A bare handle, with or without the leading @.
  const bareHandle = title.match(/^@([A-Za-z0-9._]+)$/);
  if (bareHandle) return clean(`@${bareHandle[1]}`);

  return null;
}

// Hosts whose bare domain says nothing about who published the recipe.
const GENERIC_HOSTS = new Set([
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "youtube.com",
  "youtu.be",
  "pinterest.com",
  "twitter.com",
  "x.com",
  "threads.net",
]);

/**
 * A publication name from the hostname, for pages with no `og:site_name`.
 *
 * `www.seriouseats.com` → "Seriouseats". Not perfect capitalisation — there's
 * no way to know it's "Serious Eats" without a word list — but it names the
 * source, which is the whole job. Social hosts return null so they fall to
 * `socialAccountName` instead of attributing a reel to "Instagram".
 */
export function siteNameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (GENERIC_HOSTS.has(host)) return null;

    // Drop the public suffix. Handles "example.co.uk" as well as
    // "example.com" by taking everything before the last one or two labels.
    const labels = host.split(".");
    if (labels.length < 2) return null;
    const twoLabelSuffix = labels.length > 2 && labels[labels.length - 2].length <= 3;
    const nameLabel = labels[labels.length - (twoLabelSuffix ? 3 : 2)];
    if (!nameLabel) return null;

    return clean(nameLabel.charAt(0).toUpperCase() + nameLabel.slice(1));
  } catch {
    return null;
  }
}

/**
 * Best available provenance for a page, given its metadata and URL.
 *
 * Order: an explicit `og:site_name`, then the social account that posted it,
 * then the hostname. Callers use this only when no human author was found.
 */
export function deriveSourceName({
  siteName,
  ogTitle,
  url,
}: {
  siteName?: string | null;
  ogTitle?: string | null;
  url?: string | null;
}): string | null {
  // A social post's og:site_name is the platform ("Instagram"), which `clean`
  // rejects — so the account name below wins there, and og:site_name only
  // actually lands for real publications.
  return clean(siteName) ?? socialAccountName(ogTitle) ?? siteNameFromUrl(url);
}
