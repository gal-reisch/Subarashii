import { BottomNav } from "@/components/BottomNav";

// Favorites shares the home page's card browser, so it gets the same skeleton
// shape — a heading, the filter row, and the first cards of the strip.
//
// The reason it needs one at all is less about the fallback than about the
// prefetch: Next only prefetches a dynamic route if that route has a
// `loading.tsx`, and every screen in this app is dynamic. Without this file a
// tap on the Favorites tab did nothing at all until the server answered, which
// is the "nothing happened, tap it again" feeling rather than a slow screen.
//
// The bottom nav is in here for the same reason it's in the root fallback —
// see the note there. Short version: it's rendered per-page, so leaving it out
// of the skeleton made the bar blink off on every tab tap.
export default function Loading() {
  return (
    <div className="min-h-full" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-3xl px-5 pb-32 pt-8">
        <span className="sr-only">Loading favorites…</span>

        {/* the "Favorites" heading — text-4xl, so ~40px tall */}
        <div className="h-10 w-52 animate-pulse rounded-full bg-border/70" />

        {/* search */}
        <div className="mt-6 h-[52px] w-full animate-pulse rounded-full bg-card shadow-[0px_10px_30px_rgba(0,0,0,0.06)]" />

        {/* filter chips */}
        <div className="mt-5 flex gap-5">
          {[64, 80, 72].map((w) => (
            <div
              key={w}
              style={{ width: w }}
              className="h-4 animate-pulse rounded-full bg-border/70"
            />
          ))}
        </div>

        {/* card strip */}
        <div className="-mx-5 mt-8 flex gap-5 overflow-hidden px-5">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-[380px] w-[240px] shrink-0 animate-pulse rounded-[28px] bg-border/50"
            />
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
