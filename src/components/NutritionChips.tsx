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

export interface NutritionTotals {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  isEstimated: boolean;
}

// Rough per-serving thresholds for the qualitative pills. Deliberately
// simple (no RDA %, no age/sex adjustment) — good enough for "does this
// recipe skew toward X" at a glance, not a clinical claim. Easy to retune
// once real data is flowing and we see what actually trips these.
const THRESHOLDS = {
  protein_g: 20,
  fiber_g: 5,
  sugar_g: 15,
  fat_g: 20,
} as const;

const NUTRIENTS: {
  key: keyof Omit<NutritionTotals, "isEstimated">;
  label: string;
  unit: string;
  bg: string;
  text: string;
  flagLabel?: string;
}[] = [
  { key: "calories", label: "Calories", unit: "kcal", bg: "bg-warn-bg", text: "text-warn-text" },
  {
    key: "protein_g",
    label: "Protein",
    unit: "g",
    bg: "bg-cat-protein-bg",
    text: "text-cat-protein-text",
    flagLabel: "High Protein",
  },
  { key: "carbs_g", label: "Carbs", unit: "g", bg: "bg-info-bg", text: "text-info-text" },
  {
    key: "fat_g",
    label: "Fat",
    unit: "g",
    bg: "bg-cat-fat-bg",
    text: "text-cat-fat-text",
    flagLabel: "High Fat",
  },
  {
    key: "fiber_g",
    label: "Fiber",
    unit: "g",
    bg: "bg-cat-fiber-bg",
    text: "text-cat-fiber-text",
    flagLabel: "High Fiber",
  },
  {
    key: "sugar_g",
    label: "Sugar",
    unit: "g",
    bg: "bg-cat-sugar-bg",
    text: "text-cat-sugar-text",
    flagLabel: "High Sugar",
  },
];

export function NutritionChips({ totals }: { totals: NutritionTotals }) {
  const present = NUTRIENTS.filter((n) => totals[n.key] != null);
  if (present.length === 0) return null;

  const flags = present.filter((n) => {
    if (!n.flagLabel) return false;
    const threshold = THRESHOLDS[n.key as keyof typeof THRESHOLDS];
    const value = totals[n.key];
    return threshold != null && value != null && value >= threshold;
  });

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
            <div className={`mt-1 text-2xl font-extrabold leading-none ${n.text}`}>
              {Math.round(totals[n.key] as number)}
              <span className="ml-0.5 text-sm font-bold">{n.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
