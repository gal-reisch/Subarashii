import { notFound } from "next/navigation";
import { NutritionChips } from "@/components/NutritionChips";

// DEV-ONLY visual QA harness for NutritionChips (task #20). Real recipe pages
// never fabricate nutrition numbers — this route exists purely so the chip
// styling can be screenshotted with realistic-looking sample data before the
// real database-matching/estimation pipeline exists. 404s outside
// development, same pattern as /api/dev-login.
export default function NutritionPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-2xl font-bold">NutritionChips — dev preview</h1>
      <p className="mt-1 text-sm text-muted">
        Sample data only, not a real recipe.
      </p>

      <NutritionChips
        totals={{
          calories: 420,
          protein_g: 28,
          carbs_g: 35,
          fat_g: 22,
          fiber_g: 6,
          sugar_g: 18,
          isEstimated: true,
          perServing: true,
        }}
        servings={4}
      />

      {/* The same panel dropped inside a mirrored container, which is what a
          Hebrew recipe's body is. The panel sets its own `dir="ltr"`, so the
          expected result is that this block looks *identical* to the English
          one above — same label order, same left edge, "32g" and never "g32".
          Any difference between the two is the bug. */}
      <div dir="rtl" className="mt-10 border-t border-border pt-6">
        <NutritionChips
          totals={{
            calories: 420,
            protein_g: 28,
            carbs_g: 35,
            fat_g: 22,
            fiber_g: 6,
            sugar_g: 18,
            isEstimated: true,
            perServing: true,
          }}
          servings={4}
        />
      </div>

      <div className="mt-10 border-t border-border pt-6">
        <p className="text-sm text-muted">
          No flags triggered (below thresholds):
        </p>
        <NutritionChips
          totals={{
            calories: 180,
            protein_g: 6,
            carbs_g: 20,
            fat_g: 5,
            fiber_g: 2,
            sugar_g: 4,
            isEstimated: false,
            perServing: true,
          }}
          servings={2}
        />
      </div>

      <div className="mt-10 border-t border-border pt-6">
        <p className="text-sm text-muted">
          Unknown serving count — totals are for the whole recipe and the header
          has to say so rather than claiming &quot;per serving&quot;:
        </p>
        <NutritionChips
          totals={{
            calories: 2104,
            protein_g: 96,
            carbs_g: 180,
            fat_g: 121,
            fiber_g: 14,
            sugar_g: 64,
            isEstimated: true,
            perServing: false,
          }}
          servings={null}
        />
      </div>
    </div>
  );
}
