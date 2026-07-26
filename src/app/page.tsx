import { BottomNav } from "@/components/BottomNav";
import { LinkButton } from "@/components/Button";
import { RecipeBrowser } from "@/components/RecipeBrowser";
import { randomPrompt } from "@/lib/quotes";
import { fetchRecipeCards } from "@/lib/recipeCards";
import { createServiceClient } from "@/lib/supabase/service";

// The headline is a randomly-picked prompt that has to change on every entry
// to the app. Without this the page can be prerendered once and served from
// the shell, freezing a single line in place — `force-dynamic` makes each
// request re-render, which is also what we want for a recipe list that
// changes whenever something is saved from the share sheet.
export const dynamic = "force-dynamic";

export default async function Home() {
  // Query + row→card mapping live in lib/recipeCards.ts, shared with
  // /favorites so the two card surfaces can't drift apart.
  const { recipes } = await fetchRecipeCards(createServiceClient());

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
