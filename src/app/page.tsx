import Link from "next/link";
import { BottomNav } from "@/components/BottomNav";
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
      <main className="mx-auto max-w-3xl px-5 pb-32 pt-8">
        <h1 className="text-4xl leading-tight">
          Ella&apos;s
          <br />
          Recipe Box
        </h1>

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
      <Link
        href="/add"
        className="mt-6 rounded-full bg-accent px-6 py-3 font-bold text-accent-ink shadow-[0px_10px_24px_rgba(191,74,26,0.4)] transition active:scale-95"
      >
        + Add a recipe
      </Link>
    </div>
  );
}
