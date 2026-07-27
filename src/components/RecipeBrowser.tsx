"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DeleteRecipe } from "@/components/DeleteRecipe";
import { dirFor } from "@/lib/lang";
import { CATEGORY_STYLES } from "@/lib/categoryColor";
import {
  categorizeRecipe,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type RecipeCategory,
} from "@/lib/category";
import type { CardRecipe } from "@/lib/recipeCards";

// Re-exported so the pages that render this component can keep importing the
// card's shape from the component itself.
export type { CardRecipe };

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

const INSET = u(48 + 20); // body inset is measured from the body edge, which
// itself sits 20 units in from the card group's bounding box.
// Height of the drawn top edge — the raised tab plus the panel's top-right
// corner curve, which finishes 94.5 units down and so has to be inside the
// same SVG or it gets clipped into a hard corner.
//
// Scaled against the body's own 697-unit width rather than through u(), which
// divides by the 737-unit *outer* card width. The 40-unit difference is the
// mat around the card in Figma, which this layout doesn't draw; using u() here
// would squash the shape by ~6% and flatten the 45° diagonal off true.
const TAB_H = Math.round((94.5 / 697) * CARD_W);

// Where the category label's own top edge sits inside the tab. Figma gives the
// label a 92-unit box starting at the panel's top with 32/35.2 type in it, so
// the glyphs begin (92 − 35.2) / 2 ≈ 28.4 units down — comfortably inside the
// 53.5-unit riser, which is the whole reason the riser is that tall.
const LABEL_TOP = Math.round((28.4 / 697) * CARD_W);

// The photo overlay furniture — the nutrition/needs-review badge on the left,
// the delete × on the right. Tighter into the corners than the body's text
// inset, and lower down from the top edge; see the badge's own comment.
const BADGE_INSET = u(24);
const BADGE_TOP = u(52);

// The card is taller than the traced 718 units. On a phone the strip was
// leaving a band of dead background between the cards and the bottom nav —
// the row is the only content on the page, so whatever it doesn't occupy
// reads as a mistake rather than as breathing room.
//
// The ~96 extra units are split deliberately unevenly. Almost all of it goes
// to the photo, because the body only holds three short things (label, title,
// pill) and the pill is pinned to the bottom — every pixel added there lands
// in the gap between title and pill as visible emptiness, which is the same
// "dead band" problem moved inside the card. The photo has no such problem:
// it just shows more food. The body still gets enough to clear a three-line
// title plus an author line without any card in the row outgrowing its
// siblings.
const BODY_H = u(471.5) + 24;
// The photo isn't simply "card height minus body height": the body's tab
// overlaps the photo, so photo + body − tab must equal the whole card.
const PHOTO_H = u(718) - u(471.5) + TAB_H + 72;

// The body panel's top edge, traced exactly from the Figma file rather than
// eyeballed from a screenshot.
//
// Two earlier attempts got this wrong in opposite directions. The first was a
// `clip-path: polygon()`, whose riser could only be a straight cut with hard
// corners. The second over-corrected into a long cubic S-curve. Neither is
// what the design does.
//
// The real shape, read off `Rectangle 12` in the Figma document (node
// 1521:512) via the REST API, is a *straight 45° diagonal with rounded
// joins at both ends* — the geometry below is that node's own path data, in
// its own 697-unit-wide coordinate space, reversed to run clockwise from the
// top-left and cut off below the right-hand corner:
//
//   x   0 → 300    flat, raised (this is the tab holding the category label)
//   x 300 → 329    round out of the flat, r≈41
//   x 329 → 358    the diagonal proper: Δx 29.48, Δy 29.48, i.e. exactly 45°
//   x 358 → 387    round into the low edge, r≈41
//   x 387 → 656    flat, 53.5 units below the tab
//   x 656 → 697    the panel's top-right corner, r≈41, ending 94.5 units down
//
// So the tab occupies the left 43% of the width and the riser is 53.5 units
// — both of which the guessed version had wrong (40–58%, and a curve).
//
// The viewBox is the raw Figma numbers, so the proportions can't drift: at
// CARD_W the scale factor is 240/697, which also makes the panel's 82-unit
// bottom radius land on 28px — the card's existing `rounded-[28px]`, now
// confirmed rather than coincidental.
const TAB_VB_W = 697;
const TAB_VB_H = 94.5;
const TAB_PATH =
  "M0 94.5 L0 41 C0 18.3563 18.3563 0 41 0 L300.017 0 " +
  "C310.891 0 321.32 4.31963 329.009 12.0086 L358.491 41.4914 " +
  "C366.18 49.1804 376.609 53.5 387.483 53.5 L656 53.5 " +
  "C678.644 53.5 697 71.8563 697 94.5 Z";

function RecipeCard({
  recipe,
  category,
}: {
  recipe: CardRecipe;
  category: RecipeCategory;
}) {
  const styles = CATEGORY_STYLES[category];

  // The badge slot fits one label. `needs_review` is a real, functionally
  // important state (parsing failed, details need manual entry) so it takes
  // priority over the nutrition flags when both are true — and it gets the
  // high-contrast treatment, because a warning the user can't read is worse
  // than no warning at all. Otherwise the slot carries the nutrition flag,
  // which is the common case and the one that earns the space: "High
  // Protein" is a reason to pick a recipe, "Needs review" is an exception.
  const badgeText = recipe.needs_review ? "Needs review" : (recipe.nutritionFlags[0] ?? null);
  const badgeVariant = recipe.needs_review ? "solid" : "glass";

  // Footer stat, in preference order.
  //
  // Per 100g leads because a serving isn't a unit. "450 kcal per serving"
  // can't be compared to anything — you'd have to know whether this recipe's
  // author thought a serving was a side or a dinner, and they almost never
  // say. 100g is the same 100g in every recipe in the box, so the numbers
  // line up against each other. Per-serving and whole-recipe totals stay as
  // fallbacks for recipes whose ingredient weights are too patchy for a
  // density (see caloriesPer100g), and time is the last resort for recipes
  // with no nutrition data at all.
  const stat =
    recipe.caloriesPer100g != null
      ? `${Math.round(recipe.caloriesPer100g).toLocaleString("en-US")} kcal per 100g`
      : recipe.calories != null
        ? `${Math.round(recipe.calories).toLocaleString("en-US")} kcal ${
            recipe.caloriesPerServing ? "per serving" : "total"
          }`
        : recipe.total_time_min != null
          ? `${recipe.total_time_min} min`
          : null;

  return (
    // The delete × is a sibling of the <Link>, not a child of it: a <button>
    // nested inside an <a> is invalid HTML, and browsers disagree about which
    // one a tap activates. Wrapping both in a positioned container keeps the
    // whole card tappable while the × stays its own separate control.
    <div style={{ width: CARD_W }} className="relative shrink-0">
      <Link
        href={`/recipe/${recipe.id}`}
        // The shadow used to be `0 16px 40px rgba(0,0,0,0.08)` — a wide, soft
        // pool that spread further than the gap between cards, so on the
        // horizontal strip each card sat in a visible grey smudge and the
        // neighbouring card's smudge overlapped it. Tightened to a short
        // contact shadow: enough to lift the card off the cream, small enough
        // to stay under the card.
        className="group block overflow-hidden rounded-[28px] shadow-[0px_4px_12px_rgba(0,0,0,0.06)] transition duration-100 active:scale-[0.98]"
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
            // Both this badge and the delete × opposite it sit at BADGE_INSET,
            // not at the body's text inset. They're overlaid on a photo rather
            // than set in a text column, and matching the text margin left them
            // looking timidly inset from the corners they belong to — the two
            // are corner furniture, so they hug the corners. Text floored at
            // 10px — a literal scale of Figma's 28-unit type would land under
            // 10 and stop being readable on a phone.
            <span
              style={{ left: BADGE_INSET, top: BADGE_TOP }}
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

        {/* Card body, pulled up over the photo so its top edge is a raised tab
            on the left holding the category label, then a curve down to the
            rest of the edge.

            The curve is drawn rather than clipped. `clip-path: polygon()` can
            only make that riser a straight diagonal, which is what made the
            previous version read as a sharp notch instead of the design's
            gentle S. Layering an SVG of the tab over the photo, in the body's
            own fill color, gets the real curve with no per-category asset —
            the fill is `currentColor` and the color comes from the same
            category class the body uses. */}
        <div style={{ marginTop: -TAB_H }} className={`relative ${styles.waveFill}`}>
          <svg
            style={{ height: TAB_H }}
            viewBox={`0 0 ${TAB_VB_W} ${TAB_VB_H}`}
            preserveAspectRatio="none"
            aria-hidden
            className="block w-full"
          >
            <path d={TAB_PATH} fill="currentColor" />
          </svg>
          {/* The category label belongs *in* the tab — that's what the tab is
              for, and it's why the tab is only as wide as it is. An earlier
              pass moved it down into the body because centring it left it
              jammed against the card's top edge, but that was a symptom of the
              tab being the wrong height, not of the label being in the wrong
              place. With the traced geometry there's room, so it goes back
              where the design puts it. `leading-none` because the box is
              positioned off the text's own top edge, not a line box. */}
          <p
            style={{ left: INSET, top: LABEL_TOP }}
            className={`absolute font-heading text-[11px] font-medium uppercase leading-none tracking-wide ${styles.labelText}`}
          >
            {CATEGORY_LABELS[category]}
          </p>
        </div>

        <div
          style={{ minHeight: BODY_H, paddingLeft: INSET, paddingRight: INSET }}
          className={`relative flex flex-col pb-5 ${styles.cardBg}`}
        >
          {/* `dir` on the title text only — never on the body. Putting it on the
              container mirrors the whole card (tab on the right, pill on the
              right) for a Hebrew recipe, and the app's chrome stays LTR
              regardless of recipe language. */}
          <p
            dir={dirFor(recipe.title)}
            className={`line-clamp-3 font-heading text-[24px] font-semibold leading-[1.15] ${styles.titleText}`}
          >
            {recipe.title}
          </p>
          {recipe.author && (
            // Attribution, in the design's hierarchy: category, then dish,
            // then who made it. Set quiet — same color as the title but
            // dimmed and much smaller, so it reads as a caption on the title
            // rather than a second title. Most recipes have no author, and
            // the row simply isn't rendered for those rather than reserving
            // an empty line.
            <p
              dir={dirFor(recipe.author)}
              className={`mt-1 truncate text-[11px] font-medium opacity-70 ${styles.titleText}`}
            >
              {recipe.author}
            </p>
          )}
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

      {/* Mirrors the needs-review/nutrition badge's inset on the opposite
          edge so the two sit on one line across the top of the photo.
          Deliberately quiet — a small translucent glyph, not a red button.
          Deleting a recipe is rare and the confirm dialog is the real
          safeguard, so this only needs to be findable, not prominent. */}
      <div style={{ right: BADGE_INSET, top: BADGE_TOP }} className="absolute z-10">
        <DeleteRecipe recipeId={recipe.id} title={recipe.title} variant="icon" />
      </div>
    </div>
  );
}
