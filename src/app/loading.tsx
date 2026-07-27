import { BottomNav } from "@/components/BottomNav";

// Root loading UI. The app previously had no `loading.tsx` at any level, so
// every navigation to a `force-dynamic` page (the box, a recipe) sat on the
// old screen with zero feedback until the server round-trip finished — which
// is most of why taps felt like they weren't registering. A Suspense fallback
// here means the shell paints immediately and the tap reads as acknowledged.
//
// Deliberately a skeleton of the home layout rather than a spinner: it
// occupies the same space the real content will, so the page doesn't jump
// when it swaps in.
//
// The bottom nav is part of the skeleton, and that's the single biggest thing
// here. It's rendered per-page rather than in the root layout, so a fallback
// without it made the bar itself blink out and back on every tab tap — which
// doesn't read as "loading", it reads as the whole app reloading. Keeping it
// mounted also means `usePathname` has already moved on, so the tab you just
// pressed lights up immediately and the tap is acknowledged before a single
// byte of the new screen has arrived.
export default function Loading() {
  return (
    <div className="min-h-full" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-2xl px-5 pb-32 pt-8">
        <span className="sr-only">Loading…</span>

        {/* headline */}
        <div className="h-7 w-3/4 animate-pulse rounded-full bg-border/70" />
        <div className="mt-2 h-7 w-1/2 animate-pulse rounded-full bg-border/70" />

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
