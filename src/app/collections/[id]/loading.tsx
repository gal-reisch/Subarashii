import { BottomNav } from "@/components/BottomNav";

// One shelf's contents. See the note in favorites/loading.tsx for why every
// dynamic route in this app wants one of these (no `loading.tsx`, no prefetch)
// and why the bottom nav is part of the skeleton.
//
// Adding a fallback here does change one thing: a missing shelf now answers
// 200 with the not-found page in the body rather than a real 404, because the
// response starts streaming the moment this skeleton renders and the status
// line has already gone out by the time `notFound()` fires. Next marks that
// HTML `noindex`, and this app is behind a shared PIN with nothing crawling
// it, so the status code was only ever being read by us. Worth the prefetch.
export default function Loading() {
  return (
    <div className="min-h-full" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-3xl px-5 pb-32 pt-6">
        <span className="sr-only">Loading shelf…</span>

        {/* back button */}
        <div className="h-10 w-32 animate-pulse rounded-full bg-border/70" />

        {/* the shelf name sits in an editable field, so it's a filled box rather
          than a bare heading — matching what actually arrives */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="h-[52px] min-w-0 flex-1 animate-pulse rounded-2xl bg-card shadow-[0px_6px_20px_rgba(0,0,0,0.05)]" />
          <div className="h-9 w-28 shrink-0 animate-pulse rounded-full bg-border/50" />
        </div>

        <div className="mt-3 h-4 w-28 animate-pulse rounded-full bg-border/60" />

        {/* recipe rows */}
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 w-full animate-pulse rounded-2xl bg-card shadow-[0px_10px_30px_rgba(0,0,0,0.06)]"
            />
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
