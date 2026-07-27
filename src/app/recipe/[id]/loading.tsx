import { BottomNav } from "@/components/BottomNav";

// Recipe detail skeleton. Opening a recipe is the most-tapped navigation in
// the app and the slowest (the page reads the recipe, its ingredients, its
// steps and its shelves, then computes nutrition totals), so it's the one
// that most needed a fallback — without it the tap on a card did nothing
// visible until the whole thing was ready.
//
// It also has a second job, and it's the bigger one: a dynamic route is only
// prefetched at all if it has a `loading.tsx`. Without this file the tap on a
// card starts from nothing, so this is worth keeping accurate even on the days
// it's barely visible.
//
// Kept deliberately in step with the real page's geometry, because a skeleton
// that doesn't match is worse than none — the content visibly jumps when it
// swaps in, which reads as the page loading twice. So: `pt-16` and the fixed
// full-bleed top bar, both matching page.tsx after the bar lost its pill. The
// old version of this file still drew the bar as a floating capsule at `pt-6`,
// and every recipe open shuffled itself once on arrival.
//
// The bottom nav is part of the skeleton too — see the note in the root
// loading.tsx for why.
export default function Loading() {
  return (
    <div className="min-h-full" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading recipe…</span>

      {/* The top bar: fixed, full-bleed, cream, no border yet — the real one
          only draws its hairline once the page has scrolled under it, and at
          this point nothing has. */}
      <div
        className="fixed inset-x-0 top-0 z-30 bg-background"
        style={{ paddingTop: "max(env(safe-area-inset-top), 0.5rem)" }}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 pb-2">
          <div className="h-10 w-10 animate-pulse rounded-full bg-border/70" />
          <div className="flex items-center gap-1">
            <div className="h-10 w-10 animate-pulse rounded-full bg-border/70" />
            <div className="h-10 w-10 animate-pulse rounded-full bg-border/70" />
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-5 pb-32 pt-16">
        {/* cover photo — same 16/10 and radius as the real one */}
        <div className="mt-5 aspect-[16/10] w-full animate-pulse rounded-[28px] bg-border/50" />

        {/* title */}
        <div className="mx-auto mt-6 h-9 w-2/3 animate-pulse rounded-full bg-border/70" />

        {/* meta row: servings · time · source */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4">
          {[72, 56, 64].map((w) => (
            <div
              key={w}
              style={{ width: w }}
              className="h-4 animate-pulse rounded-full bg-border/60"
            />
          ))}
        </div>

        {/* Start Cooking — inline-sized and centred, not the old full-width pill */}
        <div className="mt-5 flex justify-center">
          <div className="h-10 w-36 animate-pulse rounded-full bg-border/50" />
        </div>

        {/* ingredient rows */}
        <div className="mt-10 space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-12 w-full animate-pulse rounded-2xl bg-card"
            />
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
