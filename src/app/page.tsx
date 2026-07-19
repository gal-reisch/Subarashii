import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { RecipeBrowser, type CardRecipe } from "@/components/RecipeBrowser";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recipe")
    .select("id,title,cover_image_url,source_type,needs_review,total_time_min,cuisine")
    .order("created_at", { ascending: false });

  const recipes = (data ?? []) as CardRecipe[];

  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-5 py-6">
        <h1 className="text-3xl font-semibold">Ella&apos;s Box</h1>

        {recipes.length === 0 ? (
          <EmptyState />
        ) : (
          <RecipeBrowser recipes={recipes} />
        )}
      </main>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-16 flex flex-col items-center text-center">
      <div className="text-5xl">🍳</div>
      <h2 className="mt-4 text-xl font-semibold">Your box is empty</h2>
      <p className="mt-2 max-w-xs text-sm text-muted">
        Save your first recipe — paste a link, snap a screenshot, or type one in.
      </p>
      <Link
        href="/add"
        className="mt-6 rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink transition active:scale-95"
      >
        + Add a recipe
      </Link>
    </div>
  );
}
