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
  /** Calories from the recipe's ingredient totals (see `@/lib/nutritionCalc`).
   *  Null when no nutrition data exists yet — the footer pill falls back to
   *  `total_time_min` in that case. */
  calories: number | null;
  /** Whether `calories` is a per-serving figure or a whole-recipe total.
   *  False when the recipe never recorded a serving count. The pill labels
   *  the two differently rather than passing a tray off as a portion. */
  caloriesPerServing: boolean;
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
        // One horizontally-scrolling row rather than a two-up vertical grid.
        // The negative margin + matching padding lets the strip bleed to the
        // screen edges while the first and last card still line up with the
        // page's own gutter, so a half-visible card at the right edge is the
        // scroll affordance. Snap points keep it landing on whole cards.
        //
        // The category chips above re-filter this same row (rather than
        // adding a row per category) — the box is a personal collection, so
        // one strip stays legible and a per-category carousel stack would be
        // mostly empty.
        // `scroll-pl-5` matters more than it looks: a snap point aligns the
        // card's edge to the *snapport*, which defaults to the container's
        // border box and so cancels out the `px-5` gutter — the first card
        // ends up flush against the screen edge. Scroll-padding moves the
        // snapport in to match the gutter.
        <div className="-mx-5 mt-3 flex snap-x snap-mandatory scroll-pl-5 gap-5 overflow-x-auto px-5 pb-6 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filtered.map((r) => (
            <div key={r.id} className="snap-start">
              <RecipeCard recipe={r} category={categories.get(r.id) ?? "general"} />
            </div>
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

// Recipe card. Every number below is traced from the "Cards Layout +
// Category Color Scheme" frame in the user's Figma file, measured element by
// element in the desktop app's Design panel (the Figma MCP connector is hard
// rate-limited on the Starter plan, so canvas inspection is the only route
// to real values). Raw measurements, all in Figma units:
//
//   card group        737 × 718
//   body rect         697 × 471.5   fill = category "light"      (#B2D9D7 teal)
//   content inset      48 from the body's left edge
//   "Category"        Poppins Medium 35 / 110%, at y 0 of the body
//   recipe title      Poppins SemiBold 75 / 115%, box 568 × 128, at y 107.5
//   pill background   420 × 48, radius 250, fill = "mid"         (#89B9B9)
//   pill text         Geist Mono Medium 28 / 110%, centred, fill = "pale" (#D7FFFD)
//
// Those are expressed below as fractions of the card width so the whole card
// scales as one unit, then instantiated at CARD_W. The previous version got
// this wrong in exactly one way the user flagged: it treated the title as a
// 15px label sitting *below* a category line. In the real design the title is
// the loudest thing on the card by a wide margin — 75/35 ≈ 2.1× the category
// label — and the category label isn't a line of body text at all, it lives
// inside a raised tab that jogs up into the photo. Hence the two structural
// changes here: the title's dramatic size step, and the tab.
//
// Category *color* is auto-assigned from the recipe's type (src/lib/category.ts)
// — decorative/organizational, unrelated to the nutrition chips'
// protein/fat/sugar/fiber colors on the recipe detail page.

/** Card width in px. Everything else derives from it. Sized so a phone shows
 *  one card plus a clear slice of the next, which is what makes the
 *  horizontal strip read as scrollable without a visible affordance. */
const CARD_W = 240;
const u = (figmaUnits: number) => Math.round((figmaUnits / 737) * CARD_W);

const BODY_H = u(471.5);
const INSET = u(48 + 20); // body inset is measured from the body edge, which
// itself sits 20 units in from the card group's bounding box.
const TAB_H = u(92); // height of the raised "Category" tab = the label's box.
// The photo isn't simply "card height minus body height": the body's tab
// overlaps the photo, so photo + body − tab must equal the 718-unit card.
const PHOTO_H = u(718) - BODY_H + TAB_H;

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

  // Footer stat. Calories are the designed content — the pill in Figma reads
  // "10,250 cKal per 100gr" / "450 cKal Per Serving", i.e. a nutrition value
  // with a qualifier, not a cook time. Time is only the fallback for recipes
  // whose ingredients never resolved to any nutrition data at all.
  const stat =
    recipe.calories != null
      ? `${Math.round(recipe.calories).toLocaleString("en-US")} kcal ${
          recipe.caloriesPerServing ? "per serving" : "total"
        }`
      : recipe.total_time_min != null
        ? `${recipe.total_time_min} min`
        : null;

  return (
    <Link
      href={`/recipe/${recipe.id}`}
      style={{ width: CARD_W }}
      className="group block shrink-0 overflow-hidden rounded-[28px] shadow-[0px_16px_40px_rgba(0,0,0,0.08)] transition active:scale-[0.98]"
    >
      <div style={{ height: PHOTO_H }} className="relative w-full overflow-hidden bg-card">
        {recipe.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.cover_image_url}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center font-heading text-3xl font-semibold ${styles.titleText} ${styles.cardBg}`}
          >
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
          // Left inset matches the body's content inset (both 48 units in
          // Figma) so the badge, the category label, the title and the stat
          // pill all share one left margin. Text floored at 10px — a literal
          // scale of Figma's 28-unit type would land under 10 and stop being
          // readable on a phone.
          <span
            style={{ left: INSET, top: u(40) }}
            className={`absolute max-w-[calc(100%-2rem)] truncate rounded-full px-2 py-[3px] font-heading text-[10px] font-medium backdrop-blur-md ${
              badgeVariant === "solid"
                ? "border border-white/50 bg-black/55 text-white"
                : "border border-white bg-white/20 text-white"
            }`}
          >
            {badgeText}
          </span>
        )}
      </div>

      {/* Card body, pulled up over the photo and clipped so its top edge is a
          raised tab on the left holding the category label, then a short
          diagonal riser down to the rest of the edge. In Figma the flat top
          runs to ~43% of the body width and the riser lands at ~56%.

          The depth is a px value derived from CARD_W rather than a clip-path
          percentage, because clip-path resolves vertical percentages against
          element *height* — and the body's height varies with how many lines
          the title wraps to, which would make the tab grow and shrink per
          card. A straight-line clip needs no per-category SVG asset either;
          it just reuses the body's own background color. */}
      <div
        style={{
          marginTop: -TAB_H,
          minHeight: BODY_H,
          paddingLeft: INSET,
          paddingRight: INSET,
          clipPath: `polygon(0 0, 43% 0, 56% ${TAB_H}px, 100% ${TAB_H}px, 100% 100%, 0 100%)`,
        }}
        className={`relative flex flex-col pb-4 ${styles.cardBg}`}
      >
        <p
          style={{ height: TAB_H }}
          className={`flex items-center font-heading text-[11px] font-medium uppercase tracking-wide ${styles.labelText}`}
        >
          {CATEGORY_LABELS[category]}
        </p>
        {/* `dir` on the title text only — never on the body. Putting it on the
            container mirrors the whole card (tab on the right, pill on the
            right) for a Hebrew recipe, and the app's chrome stays LTR
            regardless of recipe language. */}
        <p
          dir={dirFor(recipe.title)}
          className={`mt-1 line-clamp-2 font-heading text-[24px] font-semibold leading-[1.15] ${styles.titleText}`}
        >
          {recipe.title}
        </p>
        {stat && (
          // Figma's pill is 420 wide on a 697-wide body (≈60%) with centred
          // Geist Mono Medium text, so this is a min-width + centred pill
          // rather than one that hugs its content. `mt-auto` pins it to the
          // bottom so pills line up across cards whose titles wrap to
          // different numbers of lines.
          <span
            style={{ minWidth: u(420) }}
            className={`mt-auto inline-block self-start rounded-full px-3 pt-[3px] pb-[4px] text-center font-mono text-[10px] font-medium ${styles.pillBg} ${styles.pillText}`}
          >
            {stat}
          </span>
        )}
      </div>
    </Link>
  );
}
