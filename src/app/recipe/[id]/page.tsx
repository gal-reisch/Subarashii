import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { createCollectionAction, toggleRecipeInCollectionAction } from "@/app/collections/actions";
import { dirFor } from "@/lib/lang";
import { createClient } from "@/lib/supabase/server";

interface Ingredient {
  id: string;
  raw_text: string;
}
interface Step {
  id: string;
  text: string;
  detected_timer_seconds: number | null;
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: recipe } = await supabase
    .from("recipe")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!recipe) notFound();

  const [{ data: ingredients }, { data: steps }, { data: collections }, { data: memberships }] =
    await Promise.all([
      supabase.from("ingredient").select("id,raw_text").eq("recipe_id", id).order("position"),
      supabase
        .from("step")
        .select("id,text,detected_timer_seconds")
        .eq("recipe_id", id)
        .order("position"),
      supabase.from("collection").select("id,name").order("sort_order"),
      supabase.from("recipe_collection").select("collection_id").eq("recipe_id", id),
    ]);

  const ings = (ingredients ?? []) as Ingredient[];
  const stps = (steps ?? []) as Step[];
  const cols = (collections ?? []) as { id: string; name: string }[];
  const memberIds = new Set((memberships ?? []).map((m) => m.collection_id));

  return (
    <div className="min-h-full">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-5 py-6">
        <Link href="/" className="text-sm text-muted hover:underline">
          ← Back to the box
        </Link>

        {recipe.cover_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.cover_image_url}
            alt=""
            className="mt-4 aspect-[16/10] w-full rounded-2xl object-cover"
          />
        )}

        <h1
          dir={dirFor(recipe.title)}
          className="mt-5 text-3xl font-semibold leading-tight"
        >
          {recipe.title}
        </h1>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          {recipe.servings && <span>{recipe.servings} servings</span>}
          {recipe.total_time_min && <span>{recipe.total_time_min} min</span>}
          {recipe.cuisine && <span>{recipe.cuisine}</span>}
          {recipe.source_url && (
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              Source ↗
            </a>
          )}
        </div>

        {(ings.length > 0 || stps.length > 0) && (
          <Link
            href={`/recipe/${recipe.id}/cook`}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-accent py-4 text-lg font-semibold text-accent-ink transition active:scale-[0.98]"
          >
            👩‍🍳 Start Cooking
          </Link>
        )}

        {recipe.needs_review && (
          <div className="mt-4 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm">
            We couldn&apos;t fully read this one. The link is saved — you can add
            the details yourself.
          </div>
        )}

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-muted">Shelves</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {cols.map((c) => {
              const isMember = memberIds.has(c.id);
              return (
                <form key={c.id} action={toggleRecipeInCollectionAction}>
                  <input type="hidden" name="recipe_id" value={recipe.id} />
                  <input type="hidden" name="collection_id" value={c.id} />
                  <input type="hidden" name="is_member" value={String(isMember)} />
                  <button
                    type="submit"
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition active:scale-95 ${
                      isMember
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-border bg-card text-foreground"
                    }`}
                  >
                    {isMember ? "✓ " : "+ "}
                    {c.name}
                  </button>
                </form>
              );
            })}
          </div>
          <form action={createCollectionAction} className="mt-2 flex gap-2">
            <input type="hidden" name="recipe_id" value={recipe.id} />
            <input
              name="name"
              placeholder="New shelf…"
              className="min-w-0 flex-1 rounded-full border border-dashed border-accent bg-card px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full border border-dashed border-accent px-3 py-1.5 text-sm font-semibold text-accent active:scale-95"
            >
              Create
            </button>
          </form>
        </section>

        {ings.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xl font-semibold">Ingredients</h2>
            <ul className="mt-3 space-y-2">
              {ings.map((ing) => (
                <li
                  key={ing.id}
                  dir={dirFor(ing.raw_text)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm"
                >
                  {ing.raw_text}
                </li>
              ))}
            </ul>
          </section>
        )}

        {stps.length > 0 && (
          <section className="mt-8">
            <h2 className="text-xl font-semibold">Steps</h2>
            <ol className="mt-3 space-y-3">
              {stps.map((step, i) => (
                <li key={step.id} className="flex gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-ink">
                    {i + 1}
                  </span>
                  <p dir={dirFor(step.text)} className="text-[15px] leading-relaxed">
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>
    </div>
  );
}
