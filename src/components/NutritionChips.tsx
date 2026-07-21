// Nutrition chips (task #20). Two layers, both styled from the same source:
// bold, saturated-pastel color-blocked cards per nutrient (drink-tracker
// reference) with big bold numbers in a small stat-card layout (trakmac
// reference — that image was for *typography/layout only*, not its dark
// color scheme).
//
//   1. Qualitative pills ("High Protein", "High Sugar"...) — the literal
//      "classify the recipe" ask. Derived from simple per-serving thresholds
//      below; only shown when a threshold is actually crossed.
//   2. The full per-serving stat grid, always shown when any value exists.
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

import { NUTRIENT_DEFS, getNutritionFlags, type NutritionTotals } from "@/lib/nutritionCalc";
export type { NutritionTotals };

export function NutritionChips({ totals }: { totals: NutritionTotals }) {
  const present = NUTRIENT_DEFS.filter((n) => totals[n.key] != null);
  if (present.length === 0) return null;

  const flagLabels = new Set(getNutritionFlags(totals));
  const flags = present.filter((n) => n.flagLabel && flagLabels.has(n.flagLabel));

  return (
    <section className="mt-8">
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-bold">Nutrition</h2>
        <span className="text-xs font-semibold text-muted">per serving</span>
        {totals.isEstimated && (
          <span className="ml-auto rounded-full bg-warn-bg px-2 py-0.5 text-[10px] font-bold text-warn-text">
            Estimated
          </span>
        )}
      </div>

      {flags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {flags.map((n) => (
            <span
              key={n.key}
              className={`rounded-full px-3 py-1.5 text-sm font-bold ${n.bg} ${n.text}`}
            >
              {n.flagLabel}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        {present.map((n) => (
          <div key={n.key} className={`rounded-2xl px-3 py-3 ${n.bg}`}>
            <div className={`text-[11px] font-bold uppercase tracking-wide ${n.text} opacity-80`}>
              {n.label}
            </div>
            <div className={`mt-1 font-mono text-2xl font-extrabold leading-none ${n.text}`}>
              {Math.round(totals[n.key] as number)}
              <span className="ml-0.5 text-sm font-bold">{n.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
