"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { dirFor } from "@/lib/lang";
import { categoryForCuisine, CATEGORY_STYLES } from "@/lib/categoryColor";

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

type TimeFilter = "any" | "30" | "60" | "60+";

// Client-side search + quick filters over the already-fetched recipe list.
// Kept simple on purpose: the box is meant to stay small (a personal
// collection, not a public catalog), so no server round-trip is needed —
// filtering an array in memory is instant and works offline-ish in a PWA.
export function RecipeBrowser({ recipes }: { recipes: CardRecipe[] }) {
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [time, setTime] = useState<TimeFilter>("any");

  const cuisines = useMemo(() => {
    const set = new Set<string>();
    for (const r of recipes) if (r.cuisine) set.add(r.cuisine);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [recipes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      if (q && !r.title.toLowerCase().includes(q)) return false;
      if (cuisine && r.cuisine !== cuisine) return false;
      if (time !== "any") {
        const t = r.total_time_min;
        if (t == null) return false;
        if (time === "30" && !(t <= 30)) return false;
        if (time === "60" && !(t > 30 && t <= 60)) return false;
        if (time === "60+" && !(t > 60)) return false;
      }
      return true;
    });
  }, [recipes, query, cuisine, time]);

  const filtersActive = query.trim() !== "" || cuisine !== null || time !== "any";

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
        <FilterChip active={time === "30"} onClick={() => setTime((t) => (t === "30" ? "any" : "30"))}>
          ≤ 30 min
        </FilterChip>
        <FilterChip active={time === "60"} onClick={() => setTime((t) => (t === "60" ? "any" : "60"))}>
          30–60 min
        </FilterChip>
        <FilterChip active={time === "60+"} onClick={() => setTime((t) => (t === "60+" ? "any" : "60+"))}>
          60+ min
        </FilterChip>
        {cuisines.map((c) => (
          <FilterChip
            key={c}
            active={cuisine === c}
            onClick={() => setCuisine((cur) => (cur === c ? null : c))}
          >
            {c}
          </FilterChip>
        ))}
        {filtersActive && (
          <button
            onClick={() => {
              setQuery("");
              setCuisine(null);
              setTime("any");
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
            <RecipeCard key={r.id} recipe={r} />
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
// Category color is auto-assigned from `cuisine` (see
// src/lib/categoryColor.ts) — a decorative/organizational system, unrelated
// to the nutrition chips' protein/fat/sugar/fiber colors shown on the
// recipe detail page.
function RecipeCard({ recipe }: { recipe: CardRecipe }) {
  const category = categoryForCuisine(recipe.cuisine);
  const styles = CATEGORY_STYLES[category];

  // The glass badge slot only fits one label. `needs_review` is a real,
  // functionally important state (parsing failed, details need manual
  // entry) so it takes priority over the cosmetic nutrition flags when both
  // are true.
  const badgeText = recipe.needs_review ? "Needs review" : (recipe.nutritionFlags[0] ?? null);

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
          // Figma's `custom glass` effect style: white 20%-opacity fill,
          // full-opacity 1px white inside stroke, fully rounded, blurred —
          // approximated with `border-white` (not `border-white/40`, which
          // was a guess from the earlier paraphrased pass) + backdrop-blur.
          <span className="absolute top-3 left-3 max-w-[calc(100%-1.5rem)] truncate rounded-full border border-white bg-white/20 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
            {badgeText}
          </span>
        )}
      </div>
      {/* Card body: pulled up over the photo's bottom edge and clipped to the
          Figma "flag notch" — traced from the real card vector (Card Layout
          Design, node 1521:512 group), pasted by the user as raw SVG since
          the Figma MCP is rate-limited. The notch is flat-diagonal-flat, not
          a single diagonal corner cut: flat top-left to x≈340 (43% of the
          697-wide shape, (340.017-40)/697), a riser down to x≈427 (55.6%,
          (427.483-40)/697) at 28px deep (matches -mt-7 almost exactly:
          Figma's 53.5-unit notch / 471.5-unit card height ≈ 11.35%, vs our
          28px / 144px photo height ≈ 19.4% — proportionally consistent once
          you account for the body-only overlap vs. whole-card scale), then
          flat again out to the right edge. A straight-line clip-path needs
          no per-category SVG asset — it just reuses the body's own bg
          color. */}
      <div
        className={`relative -mt-7 px-4 pb-4 pt-8 ${styles.cardBg}`}
        style={{ clipPath: "polygon(0 0, 43% 0, 55.6% 28px, 100% 28px, 100% 100%, 0 100%)" }}
      >
        <p className={`font-heading text-[11px] font-medium uppercase tracking-wide ${styles.labelText}`}>
          {recipe.cuisine ?? "Uncategorized"}
        </p>
        <p
          dir={dirFor(recipe.title)}
          className={`mt-1 line-clamp-2 font-heading text-[15px] font-semibold leading-snug ${styles.titleText}`}
        >
          {recipe.title}
        </p>
        {recipe.calories != null ? (
          <span className={`mt-2 inline-block rounded-full px-3 py-1 font-mono text-xs font-medium ${styles.pillBg} ${styles.pillText}`}>
            {Math.round(recipe.calories)} cal
          </span>
        ) : (
          recipe.total_time_min && (
            <span className={`mt-2 inline-block rounded-full px-3 py-1 font-mono text-xs font-medium ${styles.pillBg} ${styles.pillText}`}>
              {recipe.total_time_min} min
            </span>
          )
        )}
      </div>
    </Link>
  );
}
