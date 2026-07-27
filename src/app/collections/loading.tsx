import { BottomNav } from "@/components/BottomNav";

// Shelves list skeleton. See the note in favorites/loading.tsx for why every
// dynamic route in this app wants one of these (no `loading.tsx`, no prefetch)
// and why the bottom nav is part of the skeleton.
export default function Loading() {
  return (
    <div className="min-h-full" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-2xl px-5 pb-32 pt-8">
        <span className="sr-only">Loading shelves…</span>

        {/* "Shelves" + the line under it */}
        <div className="h-8 w-40 animate-pulse rounded-full bg-border/70" />
        <div className="mt-2 h-5 w-56 animate-pulse rounded-full bg-border/60" />

        {/* new-shelf form: input + Create */}
        <div className="mt-5 flex gap-2">
          <div className="h-[50px] flex-1 animate-pulse rounded-2xl bg-card shadow-[0px_6px_20px_rgba(0,0,0,0.05)]" />
          <div className="h-[50px] w-24 shrink-0 animate-pulse rounded-2xl bg-border/50" />
        </div>

        {/* shelf rows */}
        <div className="mt-6 space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[58px] w-full animate-pulse rounded-2xl bg-card shadow-[0px_10px_30px_rgba(0,0,0,0.06)]"
            />
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
