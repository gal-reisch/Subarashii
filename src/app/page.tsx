import { BottomNav } from "@/components/BottomNav";
import { LinkButton } from "@/components/Button";
import { RecipeBrowser, type CardRecipe } from "@/components/RecipeBrowser";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { computeNutritionTotals, getNutritionFlags } from "@/lib/nutritionCalc";
import { randomPrompt } from "@/lib/quotes";
import { createServiceClient } from "@/lib/supabase/service";

// The headline is a randomly-picked prompt that has to change on every entry
// to the app. Without this the page can be prerendered once and served from
// the shell, freezing a single line in place — `force-dynamic` makes each
// request re-render, which is also what we want for a recipe list that
// changes whenever something is saved from the share sheet.
export const dynamic = "force-dynamic";

// Raw shape of one row from the query below — includes the nested
// per-ingredient nutrition columns needed to compute each card's calorie
// footer pill + "High Protein"/"High Sugar" glass badge (same math as the
// recipe detail page's NutritionChips, via `@/lib/nutritionCalc`).
interface RecipeRow {
  id: string;
  title: string;
  cover_image_url: string | null;
  source_type: string;
  needs_review: boolean;
  total_time_min: number | null;
  cuisine: string | null;
  servings: number | null;
  ingredient: {
    calories: number | null;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
    fiber_g: number | null;
    sugar_g: number | null;
    is_estimated: boolean;
  }[] | null;
}

export default async function Home() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("recipe")
    .select(
      "id,title,cover_image_url,source_type,needs_review,total_time_min,cuisine,servings,ingredient(calories,protein_g,carbs_g,fat_g,fiber_g,sugar_g,is_estimated)",
    )
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as RecipeRow[];
  const recipes: CardRecipe[] = rows.map((r) => {
    const totals = computeNutritionTotals(r.ingredient ?? [], r.servings);
    return {
      id: r.id,
      title: r.title,
      // Normalized at render time, not just at save time, so recipes stored
      // with a Google-Images result link (which renders as a broken-image
      // icon) fix themselves without being re-saved. See lib/imageUrl.ts.
      cover_image_url: normalizeImageUrl(r.cover_image_url),
      source_type: r.source_type,
      needs_review: r.needs_review,
      total_time_min: r.total_time_min,
      cuisine: r.cuisine,
      calories: totals?.calories ?? null,
      caloriesPerServing: totals?.perServing ?? false,
      nutritionFlags: getNutritionFlags(totals),
    };
  });

  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-3xl px-5 pb-32 pt-8">
        <h1 className="text-3xl leading-tight text-balance">{randomPrompt()}</h1>

        {recipes.length === 0 ? (
          <EmptyState />
        ) : (
          <RecipeBrowser recipes={recipes} />
        )}
      </main>
      <BottomNav />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-16 flex flex-col items-center text-center">
      <div className="text-5xl">🍳</div>
      <h2 className="mt-4 text-xl">Your box is empty</h2>
      <p className="mt-2 max-w-xs text-sm text-muted">
        Save your first recipe — paste a link, snap a screenshot, or type one in.
      </p>
      <LinkButton href="/add" className="mt-6 px-6 py-3 active:scale-95">
        + Add a recipe
      </LinkButton>
    </div>
  );
}
