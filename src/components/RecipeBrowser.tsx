"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { dirFor } from "@/lib/lang";
import { CATEGORY_STYLES } from "@/lib/categoryColor";
import {
  categorizeRecipe,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type RecipeCategory,
} from "@/lib/category";

export interface CardRecipe {
  id: string;
  title: string;
  cover_image_url: string | null;
  source_type: string;
  needs_review: boolean;
  total_time_min: number | null;
  cuisine: string | null;
  /** Per-serving calories, computed server-side from ingredient totals
   *  (see `@/lib/nutritionCalc`). Null when no nutrition data exists yet —
   *  the footer pill falls back to `total_time_min` in that case. */
  calories: number | null;
  /** "High Protein"/"High Sugar"/etc, same classification as the recipe
   *  detail page's NutritionChips. The card only has room for one badge, so
   *  RecipeCard shows the first flag (falls back to nothing if none). */
  nutritionFlags: string[];
}

// Client-side search + quick filters over the already-fetched recipe list.
// Kept simple on purpose: the box is meant to stay small (a personal
// collection, not a public catalog), so no server round-trip is needed —
// filtering an array in memory is instant and works offline-ish in a PWA.
export function RecipeBrowser({ recipes }: { recipes: CardRecipe[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<RecipeCategory | null>(null);

  // Categorize once per list rather than once per card render — the same
  // derived value drives the filter chips, the card color and the card label,
  // so they can't drift apart.
  const categories = useMemo(() => {
    const map = new Map<string, RecipeCategory>();
    for (const r of recipes) {
      map.set(r.id, categorizeRecipe({ title: r.title, cuisine: r.cuisine }));
    }
    return map;
  }, [recipes]);

  // Only offer chips for categories that actually appear in the box, so a
  // small collection doesn't show four dead filters.
  const availableCategories = useMemo(() => {
    const present = new Set(categories.values());
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [categories]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      if (q && !r.title.toLowerCase().includes(q)) return false;
      if (category && categories.get(r.id) !== category) return false;
      return true;
    });
  }, [recipes, query, category, categories]);

  const filtersActive = query.trim() !== "" || category !== null;

  return (
    <div>
      <div className="mt-6 flex items-center gap-3 rounded-full bg-card px-5 py-3.5 shadow-[0px_10px_30px_rgba(0,0,0,0.06)]">
        <SearchIcon />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          type="search"
          placeholder="Search"
          className="w-full bg-transparent text-base outline-none placeholder:text-muted/70"
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
        {availableCategories.map((c) => (
          <FilterChip
            key={c}
            active={category === c}
            onClick={() => setCategory((cur) => (cur === c ? null : c))}
          >
            {CATEGORY_LABELS[c]}
          </FilterChip>
        ))}
        {filtersActive && (
          <button
            onClick={() => {
              setQuery("");
              setCategory(null);
            }}
            className="text-sm font-semibold text-muted underline-offset-2 hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <p className="mt-4 text-sm text-muted">
        {filtered.length} {filtered.length === 1 ? "recipe" : "recipes"}
      </p>

      {filtered.length === 0 ? (
        <p className="mt-8 text-center text-muted">No recipes match your search.</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-5">
          {filtered.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              category={categories.get(r.id) ?? "general"}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" className="shrink-0 text-muted">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative pb-1 text-[15px] font-semibold transition active:scale-95 ${
        active ? "text-accent" : "text-muted"
      }`}
    >
      {children}
      {active && (
        <span className="absolute inset-x-0 -bottom-0.5 h-[3px] rounded-full bg-accent" />
      )}
    </button>
  );
}

// Recipe card, redesigned per the user's Figma style guide (task #24).
// Re-verified directly against the live Figma file (desktop app inspection,
// not just the earlier paraphrased style summary) after the user flagged
// mismatches:
//   - The photo→body transition is a diagonal "flag notch" (flat edge that
//     angles up to a triangular photo reveal at the top-right), not a wave.
//   - The photo badge uses Figma's `custom glass` effect style: white fill
//     at 20% opacity, a full-opacity 1px white inside stroke, fully rounded
//     corners, backdrop blur. Confirmed via the Design panel's Fill/Effects
//     fields on the badge background rectangle.
// Category color is auto-assigned from the recipe's *type* (see
// src/lib/category.ts) — a decorative/organizational system, unrelated to the
// nutrition chips' protein/fat/sugar/fiber colors shown on the recipe detail
// page.
function RecipeCard({
  recipe,
  category,
}: {
  recipe: CardRecipe;
  category: RecipeCategory;
}) {
  const styles = CATEGORY_STYLES[category];

  // The badge slot only fits one label. `needs_review` is a real,
  // functionally important state (parsing failed, details need manual
  // entry) so it takes priority over the cosmetic nutrition flags when both
  // are true — and it gets the high-contrast badge treatment, because a
  // warning the user can't read is worse than no warning at all.
  const badgeText = recipe.needs_review ? "Needs review" : (recipe.nutritionFlags[0] ?? null);
  const badgeVariant = recipe.needs_review ? "solid" : "glass";

  return (
    <Link
      href={`/recipe/${recipe.id}`}
      className="group block overflow-hidden rounded-[28px] shadow-[0px_16px_40px_rgba(0,0,0,0.08)] transition active:scale-[0.98]"
    >
      <div className="relative h-36 w-full overflow-hidden bg-card">
        {recipe.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.cover_image_url}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className={`flex h-full w-full items-center justify-center text-3xl font-bold ${styles.titleText} ${styles.cardBg}`}>
            {recipe.title.charAt(0).toUpperCase()}
          </div>
        )}
        {badgeText && (
          // Two badge treatments over the photo:
          //
          //  - "glass" is Figma's `custom glass` effect style (white
          //    20%-opacity fill, full-opacity 1px white inside stroke, fully
          //    rounded, blurred). It looks right over a typical food photo,
          //    but white-on-white is illegible over a pale one.
          //  - "solid" is the readable fallback for badges that carry real
          //    meaning rather than decoration. It keeps the same blurred
          //    pill silhouette but inverts to a dark scrim, so it holds
          //    contrast over light AND dark photos.
          //
          // Sizing/placement traced from the Figma card (glass chip 295x48 at
          // a 68px inset on a 737px-wide card ≈ 9% inset, 42% of the photo
          // width); scaled to the app's ~165px card, with the text floored at
          // 10px since a literal 0.22x scale would be unreadable.
          <span
            className={`absolute top-2.5 left-3.5 max-w-[calc(100%-1.75rem)] truncate rounded-full px-2 py-[3px] text-[10px] font-semibold backdrop-blur-md ${
              badgeVariant === "solid"
                ? "border border-white/50 bg-black/55 text-white"
                : "border border-white bg-white/20 text-white"
            }`}
          >
            {badgeText}
          </span>
        )}
      </div>
      {/* Card body: pulled up over the photo's bottom edge and clipped to the
          Figma "flag notch" — flat top-left to x≈340 (43% of the 697-wide
          shape), a riser down to x≈427 (55.6%), then flat again out to the
          right edge.

          The notch DEPTH is the part that was visibly wrong before. The x
          coordinates are percentages (so they shrink with the card) but the
          depth was a hardcoded 28px carried over from the Figma artboard,
          which meant the diagonal got dramatically steeper as the card
          scaled down — a ~53° riser against Figma's ~31°. Depth has to scale
          with the card too: Figma's riser runs 87.5 units across for 53.5
          down, so at our card's ~165px width the 12.6% run is ~21px and the
          matching drop is 21 * (53.5/87.5) ≈ 13px. That also lands within a
          pixel of the depth implied by the body-height ratio (53.5/471.5 ≈
          11.3% of a ~100px body), so both derivations agree.

          A straight-line clip-path needs no per-category SVG asset — it just
          reuses the body's own bg color. */}
      {/* `dir` goes on the body, not just the title, so a Hebrew recipe's
          category label and stat pill right-align along with the title instead
          of leaving the label stranded on the left of an otherwise RTL card.
          The clip-path notch is unaffected by `dir` and deliberately stays put
          — it's a fixed graphic element of the card, not text flow. */}
      <div
        dir={dirFor(recipe.title)}
        className={`relative -mt-7 px-4 pb-4 pt-8 ${styles.cardBg}`}
        style={{ clipPath: "polygon(0 0, 43% 0, 55.6% 13px, 100% 13px, 100% 100%, 0 100%)" }}
      >
        <p className={`font-heading text-[11px] font-medium uppercase tracking-wide ${styles.labelText}`}>
          {CATEGORY_LABELS[category]}
        </p>
        <p
          className={`mt-1 line-clamp-2 font-heading text-[15px] font-semibold leading-snug ${styles.titleText}`}
        >
          {recipe.title}
        </p>
        {/* Footer stat pill. Figma's is 420x48 on a 697-wide body (≈60% width)
            with centered Geist Mono Medium text, so this uses a min-width +
            centered text rather than hugging its content. */}
        {recipe.calories != null ? (
          <span className={`mt-2 inline-block min-w-[4.5rem] rounded-full px-3 py-1 text-center font-mono text-[11px] font-medium ${styles.pillBg} ${styles.pillText}`}>
            {Math.round(recipe.calories)} cal
          </span>
        ) : (
          recipe.total_time_min && (
            <span className={`mt-2 inline-block min-w-[4.5rem] rounded-full px-3 py-1 text-center font-mono text-[11px] font-medium ${styles.pillBg} ${styles.pillText}`}>
              {recipe.total_time_min} min
            </span>
          )
        )}
      </div>
    </Link>
  );
}
