import { BottomNav } from "@/components/BottomNav";
import { LinkButton } from "@/components/Button";
import { HomeGreeting } from "@/components/HomeGreeting";
import { RecipeBrowser } from "@/components/RecipeBrowser";
import {
  DEFAULT_TIME_ZONE,
  dayKey,
  newSeed,
  startOfWeekMs,
  type BoxContext,
} from "@/lib/homeGreeting";
import { fetchRecipeCards, type CardRecipe } from "@/lib/recipeCards";
import { createServiceClient } from "@/lib/supabase/service";

// The headline is a randomly-picked prompt that has to change on every entry
// to the app. Without this the page can be prerendered once and served from
// the shell, freezing a single line in place — `force-dynamic` makes each
// request re-render, which is also what we want for a recipe list that
// changes whenever something is saved from the share sheet.
export const dynamic = "force-dynamic";

/** At or under this many minutes counts as "quick" in the headline. Matches
 *  the home filter's own quick threshold. */
const QUICK_MINUTES = 30;

export default async function Home() {
  // Query + row→card mapping live in lib/recipeCards.ts, shared with
  // /favorites so the two card surfaces can't drift apart.
  const { recipes } = await fetchRecipeCards(createServiceClient());

  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-3xl px-5 pb-32 pt-8">
        {/* The seed is drawn here, once per request, rather than inside the
            client component: it's what makes the line change on every entry
            to the app, and it has to survive the client re-picking the line
            against the device's clock. */}
        <HomeGreeting
          serverKey={dayKey(new Date(), DEFAULT_TIME_ZONE)}
          box={boxContext(recipes)}
          seed={newSeed()}
        />

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

// The headline's view of the box. Derived from the list already fetched, so
// personalizing the greeting costs no extra round trip.
function boxContext(recipes: CardRecipe[]): BoxContext {
  // "New this week" counts from the local Sunday rather than a rolling seven
  // days, because that's what the phrase means in the house it's describing.
  const cutoff = startOfWeekMs(new Date(), DEFAULT_TIME_ZONE);

  return {
    total: recipes.length,
    addedThisWeek: recipes.filter((r) => new Date(r.created_at).getTime() >= cutoff).length,
    needsReview: recipes.filter((r) => r.needs_review).length,
    quick: recipes.filter((r) => r.total_time_min != null && r.total_time_min <= QUICK_MINUTES)
      .length,
  };
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
