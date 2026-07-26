// Recipe detail skeleton. Opening a recipe is the most-tapped navigation in
// the app and the slowest (the page reads the recipe, its ingredients, its
// steps and its shelves, then computes nutrition totals), so it's the one
// that most needed a fallback — without it the tap on a card did nothing
// visible until the whole thing was ready.
export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-5 pb-32 pt-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading recipe…</span>

      {/* top bar: back + actions */}
      <div className="flex items-center justify-between">
        <div className="h-10 w-10 animate-pulse rounded-full bg-border/70" />
        <div className="h-6 w-6 animate-pulse rounded-full bg-border/70" />
      </div>

      {/* hero photo */}
      <div className="mt-4 h-64 w-full animate-pulse rounded-[28px] bg-border/50" />

      {/* title */}
      <div className="mx-auto mt-6 h-8 w-2/3 animate-pulse rounded-full bg-border/70" />

      {/* start cooking CTA */}
      <div className="mt-6 h-14 w-full animate-pulse rounded-full bg-border/50" />

      {/* ingredient rows */}
      <div className="mt-10 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 w-full animate-pulse rounded-2xl bg-card" />
        ))}
      </div>
    </div>
  );
}
