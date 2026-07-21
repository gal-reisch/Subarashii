// Shared fetch helper for the nutrition-matching external calls (USDA,
// Tzameret). Adds a timeout AND a small retry for transient failures.
//
// Confirmed via live testing (2026-07-21): USDA's FDC API gateway
// intermittently returns a raw nginx "400 Bad Request" HTML page for a
// perfectly well-formed, previously-successful request — roughly 1 in 3
// calls, even for a single sequential request with `x-ratelimit-remaining`
// nowhere near exhausted (~3550/3600). So this is not a rate limit and not a
// code bug in the request itself; it's transient flakiness on the gateway.
// A short retry absorbs it instead of silently dropping a real match down to
// the LLM fallback (see usda.ts / relevance.ts for why that fallback should
// be reserved for genuinely unmatchable ingredients, not gateway hiccups).
const TIMEOUT_MS = 8000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Never throws — any failure (network, timeout, non-2xx after retries,
// malformed JSON) yields null so callers fall through to the next tier
// (other database, then LLM estimate).
export async function fetchJsonWithRetry(url: string): Promise<unknown | null> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (res.ok) {
        return await res.json();
      }
      // Client errors other than a bare "Bad Request" (e.g. 401/403 for a
      // bad key, 404) are not going to fix themselves on retry — only retry
      // on 400 (the observed transient gateway flake) and 5xx/network-level
      // issues.
      if (res.status !== 400 && res.status < 500) return null;
    } catch {
      // network error / timeout — worth retrying too
    } finally {
      clearTimeout(timer);
    }
    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
  }
  return null;
}
