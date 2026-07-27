// Nutrition chips (task #20, restyled in #41). Two layers:
//
//   1. Qualitative pills ("High Protein", "High Sugar"...) — the literal
//      "classify the recipe" ask. Derived from simple per-serving thresholds
//      in nutritionCalc; only shown when a threshold is actually crossed.
//   2. The full per-serving stat grid, always shown when any value exists.
//
// The two used to look the same: a pastel card per nutrient, each in its own
// hue, flags and stats alike. That made the panel a swatch board — six colors
// with no shared meaning, and reading it meant parsing the palette before the
// numbers. It also flattened the hierarchy, because the summary line and the
// detail behind it were styled identically.
//
// So the layers are now told apart by weight rather than by hue. The stat
// grid is quiet: pink outline, pink text, no fill. The flags are loud: a pink
// gradient fill, no outline, and a slow glow (see `.flag-glow` in globals.css)
// — one moving thing on the page, and it's the one-line summary. Everything
// is the same pink, so "which color is fat again?" stops being a question.
//
// Every number here traces back to real per-ingredient values summed from
// the `ingredient` table (see RecipePage) — nothing is fabricated in this
// component. If any contributing ingredient was LLM-estimated rather than
// database-matched (is_estimated), the section is labeled "Estimated" so it
// never reads as measured fact.
//
// Threshold/label logic lives in `@/lib/nutritionCalc` so the home page's
// recipe cards (glass badge) can reuse the exact same "High Protein" etc.
// classification instead of re-deriving it — see RecipeBrowser.tsx.

import {
  NUTRIENT_DEFS,
  getNutritionFlags,
  type NutritionTotals,
} from "@/lib/nutritionCalc";
import { RECIPE_UI } from "@/lib/recipeStrings";
export type { NutritionTotals };

export function NutritionChips({
  totals,
  servings,
  servingsControl,
  estimatedChip,
}: {
  totals: NutritionTotals;
  /** The recipe's declared serving count, or null when it never stated one. */
  servings: number | null;
  /** Rendered under the header — the inline "how many servings?" form from
   *  the recipe page. Passed in rather than imported so this component stays
   *  presentational and reusable. */
  servingsControl?: React.ReactNode;
  /** The clickable "Estimated" chip, passed in because it's a client
   *  component with its own dialog and this file is presentational. Only
   *  supplied when the totals are actually estimated. */
  estimatedChip?: React.ReactNode;
}) {
  const present = NUTRIENT_DEFS.filter((n) => totals[n.key] != null);
  if (present.length === 0) return null;

  const flagLabels = new Set(getNutritionFlags(totals));
  const flags = present.filter(
    (n) => n.flagLabel && flagLabels.has(n.flagLabel),
  );

  return (
    // `dir="ltr"` regardless of the recipe. Every string in this panel is the
    // app's own — "Nutrition", "per serving", "High Protein", "Calories" — and
    // the two things it lays out are a flex row and a 3-column grid, both of
    // which fill in reading order. Inherit `rtl` from a Hebrew recipe's body
    // and the nutrients come out Sugar-first with the header's chips mirrored,
    // which is nobody's intended reading order for English labels.
    <section dir="ltr" className="mt-8">
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-bold">{RECIPE_UI.nutrition}</h2>
        {/* This label used to read "per serving" unconditionally, including
            for recipes that never recorded a serving count — in which case
            computeNutritionTotals returns whole-recipe totals and the header
            was flatly lying. A tray of meatballs was being presented as a
            2,104 kcal portion. Say which of the two the numbers actually are. */}
        <span className="text-xs font-semibold text-muted">
          {totals.perServing
            ? RECIPE_UI.perServing(servings)
            : RECIPE_UI.wholeRecipe}
        </span>
        {totals.isEstimated && estimatedChip}
      </div>

      {servingsControl}

      {flags.length > 0 && (
        // `pb-1` on the row so the glow has somewhere to land instead of
        // being clipped against the stat grid directly underneath.
        <div className="mt-3 flex flex-wrap gap-3 pb-1">
          {flags.map((n) => (
            <span
              key={n.key}
              className="flag-glow rounded-full bg-gradient-to-br from-accent to-accent-soft px-3.5 py-1.5 font-heading text-sm font-semibold text-accent-ink"
            >
              {n.flagLabel}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        {present.map((n) => (
          <div
            key={n.key}
            className="rounded-2xl border border-accent px-3 py-3 text-accent-deep"
          >
            {/* Straight off NUTRIENT_DEFS. These used to be looked up through
                a per-language table so a Hebrew recipe got "חלבון"; with the
                app English everywhere that table was a verbatim copy of these
                labels, and a copy is a thing that can drift. The home card's
                badge reads the same field. */}
            <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
              {n.label}
            </div>
            <div className="mt-1 font-mono text-2xl font-extrabold leading-none">
              {/* Redundant against the section's own `dir` above, and kept
                  anyway: it's what guarantees "32g" never renders as "g32" if
                  this component is ever dropped into a mirrored context that
                  the section-level attribute doesn't cover. */}
              <span dir="ltr" className="inline-block">
                {Math.round(totals[n.key] as number)}
                <span className="ml-0.5 text-sm font-bold">{n.unit}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
