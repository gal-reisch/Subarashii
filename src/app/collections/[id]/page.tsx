import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { dirFor } from "@/lib/lang";
import { createClient } from "@/lib/supabase/server";
import {
  deleteCollectionAction,
  removeRecipeFromCollectionAction,
  renameCollectionAction,
} from "../actions";

interface MemberRow {
  recipe: {
    id: string;
    title: string;
    cover_image_url: string | null;
    needs_review: boolean;
    total_time_min: number | null;
  } | null;
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: collection } = await supabase
    .from("collection")
    .select("id,name")
    .eq("id", id)
    .maybeSingle();
  if (!collection) notFound();

  const { data: members } = await supabase
    .from("recipe_collection")
    .select("recipe:recipe_id(id,title,cover_image_url,needs_review,total_time_min)")
    .eq("collection_id", id)
    .order("sort_order");

  const recipes = ((members ?? []) as unknown as MemberRow[])
    .map((m) => m.recipe)
    .filter((r): r is NonNullable<MemberRow["recipe"]> => r !== null);

  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-5 py-6">
        <Link href="/collections" className="text-sm text-muted hover:underline">
          ← All shelves
        </Link>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <form action={renameCollectionAction} className="flex flex-1 gap-2">
            <input type="hidden" name="collection_id" value={collection.id} />
            <input
              name="name"
              defaultValue={collection.name}
              className="min-w-0 flex-1 rounded-xl border border-border bg-card px-4 py-2 text-2xl font-semibold"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full border border-border px-4 py-2 text-sm font-semibold active:scale-95"
            >
              Rename
            </button>
          </form>
          <form action={deleteCollectionAction}>
            <input type="hidden" name="collection_id" value={collection.id} />
            <button
              type="submit"
              className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-accent active:scale-95"
            >
              Delete shelf
            </button>
          </form>
        </div>

        <p className="mt-3 text-sm text-muted">
          {recipes.length} {recipes.length === 1 ? "recipe" : "recipes"}
        </p>

        {recipes.length === 0 ? (
          <p className="mt-10 text-center text-muted">
            Nothing here yet — open a recipe and add it to this shelf.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {recipes.map((r) => (
              <div
                key={r.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
              >
                <Link href={`/recipe/${r.id}`} className="flex flex-1 flex-col active:scale-[0.98]">
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-accent/10">
                    {r.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.cover_image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-4xl font-semibold text-accent/50">
                        {r.title.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {r.needs_review && (
                      <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-semibold text-accent">
                        Needs review
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p
                      dir={dirFor(r.title)}
                      className="line-clamp-2 text-sm font-semibold leading-snug"
                    >
                      {r.title}
                    </p>
                    {r.total_time_min && (
                      <p className="mt-1 text-xs text-muted">{r.total_time_min} min</p>
                    )}
                  </div>
                </Link>
                <form action={removeRecipeFromCollectionAction} className="absolute right-2 top-2">
                  <input type="hidden" name="recipe_id" value={r.id} />
                  <input type="hidden" name="collection_id" value={collection.id} />
                  <button
                    type="submit"
                    aria-label={`Remove ${r.title} from this shelf`}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-sm font-semibold shadow active:scale-90"
                  >
                    ✕
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
