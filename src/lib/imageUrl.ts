// Normalizing whatever ends up in `cover_image_url`.
//
// The manual "add a recipe" form asks for an image URL, and the natural way to
// get one is to search Google Images, right-click the result and copy the link.
// What that copies is NOT the image — it's Google's *result page*:
//
//   https://www.google.com/imgres?imgurl=https%3A%2F%2Fexample.com%2Fpie.jpg&…
//
// Dropped into an <img src>, that renders a broken-image icon. The real URL is
// sitting right there in the `imgurl` query parameter, so unwrap it.
//
// Applied in two places, for the same reason as the step-merge helper: at save
// time so new recipes store a clean URL, and at render time so recipes already
// in the box stop showing a broken thumbnail without anyone re-saving them.

// Google's image-result wrapper, plus the newer /url?q= redirector.
const WRAPPERS: { host: RegExp; param: string }[] = [
  { host: /(^|\.)google\.[a-z.]+$/i, param: "imgurl" },
  { host: /(^|\.)google\.[a-z.]+$/i, param: "url" },
  { host: /(^|\.)google\.[a-z.]+$/i, param: "q" },
];

/**
 * Return a directly-loadable image URL, or null if the input can't be one.
 *
 * Rejects anything that isn't http(s) — a `javascript:` or `data:` URL in an
 * <img src> is at best broken and at worst a way to get script into the page
 * via a field the user pastes into.
 */
export function normalizeImageUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  for (const { host, param } of WRAPPERS) {
    if (!host.test(url.hostname)) continue;
    const inner = url.searchParams.get(param);
    if (!inner) continue;
    // Recurse so a doubly-wrapped link still resolves, and so the inner URL
    // gets the same protocol check rather than being trusted blindly.
    const unwrapped = normalizeImageUrl(inner);
    if (unwrapped) return unwrapped;
  }

  return url.toString();
}
