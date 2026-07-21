import { BottomNav } from "@/components/BottomNav";
import { LinkButton } from "@/components/Button";
import { RecipeBrowser, type CardRecipe } from "@/components/RecipeBrowser";
import { computeNutritionTotals, getNutritionFlags } from "@/lib/nutritionCalc";
import { createClient } from "@/lib/supabase/server";

// Favorites view (task #24) — backs the Figma nav's dedicated "Favorites"
// tab. Same card grid as the home page, filtered to recipes with the
// household-shared `is_favorite` flag set (see migration 0005_favorite.sql).

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

export default async function FavoritesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipe")
    .select(
      "id,title,cover_image_url,source_type,needs_review,total_time_min,cuisine,servings,ingredient(calories,protein_g,carbs_g,fat_g,fiber_g,sugar_g,is_estimated)",
    )
    .eq("is_favorite", true)
    .order("created_at", { ascending: false });

  // Graceful degradation: if migration 0005 hasn't been applied yet, the
  // `is_favorite` column doesn't exist and the query errors — show a setup
  // notice instead of crashing the page.
  const migrationMissing = !!error;

  const rows = (data ?? []) as unknown as RecipeRow[];
  const recipes: CardRecipe[] = rows.map((r) => {
    const totals = computeNutritionTotals(r.ingredient ?? [], r.servings);
    return {
      id: r.id,
      title: r.title,
      cover_image_url: r.cover_image_url,
      source_type: r.source_type,
      needs_review: r.needs_review,
      total_time_min: r.total_time_min,
      cuisine: r.cuisine,
      calories: totals?.calories ?? null,
      nutritionFlags: getNutritionFlags(totals),
    };
  });

  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-3xl px-5 pb-32 pt-8">
        <h1 className="text-4xl leading-tight">Favorites</h1>

        {migrationMissing ? (
          <SetupNotice />
        ) : recipes.length === 0 ? (
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
      <div className="text-5xl">💗</div>
      <h2 className="mt-4 text-xl">No favorites yet</h2>
      <p className="mt-2 max-w-xs text-sm text-muted">
        Open a recipe and tap the heart to keep it here for quick access.
      </p>
      <LinkButton href="/" className="mt-6 px-6 py-3 active:scale-95">
        Browse the box
      </LinkButton>
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="mt-8 rounded-2xl bg-warn-bg p-4 text-sm text-warn-text">
      Favorites need a one-time database update. Run{" "}
      <code className="font-mono">supabase/migrations/0005_favorite.sql</code> in the
      Supabase SQL editor, then reload — the heart on each recipe will start saving here.
    </div>
  );
}
