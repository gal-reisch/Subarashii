// Subarashii service worker — stale-while-revalidate for same-origin GETs so
// saved recipes remain viewable offline in the kitchen.
const CACHE = "subarashii-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Next.js client-side navigation re-fetches the current URL to ask for a
  // React Server Components payload instead of full HTML (flagged via these
  // headers). Caching those by URL would let a stale full-HTML response
  // (cached from an earlier hard load of the same path) get served back for
  // an RSC fetch, which the client can't parse and crashes on. Let those go
  // straight to the network — only cache real page loads and static assets.
  const isRscFetch =
    req.headers.has("RSC") ||
    req.headers.has("Next-Router-State-Tree") ||
    req.headers.has("Next-Router-Prefetch");
  const isCacheable =
    !isRscFetch &&
    (req.mode === "navigate" || url.pathname.startsWith("/_next/static/"));

  if (!isCacheable) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
