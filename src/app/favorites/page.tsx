import { BottomNav } from "@/components/BottomNav";
import { LinkButton } from "@/components/Button";
import { RecipeBrowser } from "@/components/RecipeBrowser";
import { fetchRecipeCards } from "@/lib/recipeCards";
import { createServiceClient } from "@/lib/supabase/service";

// Favorites view (task #24) — backs the Figma nav's dedicated "Favorites"
// tab. Same cards as the home page (shared query in lib/recipeCards.ts),
// filtered to recipes with the household-shared `is_favorite` flag set (see
// migration 0005_favorite.sql).

export default async function FavoritesPage() {
  // `failed` here means the filter column itself is missing — unlike the home
  // page, this view is nothing without `is_favorite`, so it says so rather
  // than rendering an empty box that looks like "you have no favorites".
  const { recipes, failed: migrationMissing } = await fetchRecipeCards(createServiceClient(), {
    favoritesOnly: true,
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
