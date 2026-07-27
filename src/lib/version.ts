// What's actually running, so a push can be told apart from a stale cache.
//
// The problem this solves is specific: you push, open the app on your phone,
// and it looks the same. That's either "the deploy didn't land" or "iOS is
// still serving the old service-worker cache", and from the outside those look
// identical. A marker that changes on every commit tells them apart in one
// glance — if the marker moved, the deploy landed and you're looking at new
// code; if it didn't, it's the deploy, not the cache.
//
// So the commit hash is the load-bearing half, not the version number. It
// can't go stale, because nobody maintains it: Vercel sets
// `VERCEL_GIT_COMMIT_SHA` from the commit it's building, and next.config.ts
// reads it (falling back to the local `git rev-parse` in dev) and inlines it
// at build time. The version number beside it is the friendly one — it comes
// from package.json and is bumped by hand, so treat it as a label rather than
// as evidence.
//
// Deliberately not a runtime `git` call: there's no git binary in a serverless
// runtime, and shelling out per request to render eleven characters would be a
// poor trade even where there is one.

/** Short commit hash of the running build, or `"dev"` when it can't be known
 *  (no Vercel env and no git checkout — e.g. a bare production container). */
export const APP_COMMIT = process.env.NEXT_PUBLIC_APP_COMMIT || "dev";

/** Hand-maintained, from package.json. Bumped alongside a push. */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";

/** e.g. `v0.2.0 · caa57d3` — what the home page corner shows. */
export const versionLabel = () => `v${APP_VERSION} · ${APP_COMMIT}`;
