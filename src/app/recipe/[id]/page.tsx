import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { BottomNav } from "@/components/BottomNav";
import { LinkButton } from "@/components/Button";
import { NutritionChips } from "@/components/NutritionChips";
import { toggleFavoriteAction } from "@/app/actions";
import { createCollectionAction, toggleRecipeInCollectionAction } from "@/app/collections/actions";
import { dirFor } from "@/lib/lang";
import { computeNutritionTotals } from "@/lib/nutritionCalc";
import { createServiceClient } from "@/lib/supabase/service";

interface Ingredient {
  id: string;
  raw_text: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  is_estimated: boolean;
}

interface Step {
  id: string;
  text: string;
  detected_timer_seconds: number | null;
  kind: "instruction" | "tip" | "ignored";
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: recipe } = await supabase
    .from("recipe")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!recipe) notFound();

  const [{ data: ingredients }, { data: steps }, { data: collections }, { data: memberships }] =
    await Promise.all([
      supabase
        .from("ingredient")
        .select("id,raw_text,calories,protein_g,carbs_g,fat_g,fiber_g,sugar_g,is_estimated")
        .eq("recipe_id", id)
        .order("position"),
      supabase
        .from("step")
        .select("id,text,detected_timer_seconds,kind")
        .eq("recipe_id", id)
        .order("position"),
      supabase.from("collection").select("id,name").order("sort_order"),
      supabase.from("recipe_collection").select("collection_id").eq("recipe_id", id),
    ]);

  const ings = (ingredients ?? []) as Ingredient[];
  const stps = (steps ?? []) as Step[];
  const cols = (collections ?? []) as { id: string; name: string }[];
  const memberIds = new Set((memberships ?? []).map((m) => m.collection_id));
  const nutritionTotals = computeNutritionTotals(ings, recipe.servings);

  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-2xl px-5 pb-32 pt-6">
        <div className="flex items-center justify-between">
          <BackButton href="/" label="Back to the box" />
          {/* Favorite toggle (task #24) — plain-submit form, no client JS.
              `recipe.is_favorite` is undefined until migration 0005 is
              applied; treat that as not-favorited. */}
          <form action={toggleFavoriteAction}>
            <input type="hidden" name="recipe_id" value={recipe.id} />
            <input type="hidden" name="is_favorite" value={String(!!recipe.is_favorite)} />
            <button
              type="submit"
              aria-label={recipe.is_favorite ? "Remove from favorites" : "Add to favorites"}
              aria-pressed={!!recipe.is_favorite}
              className="flex h-10 w-10 items-center justify-center rounded-full text-accent transition active:scale-90"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 20s-7-4.35-9.33-8.5C1.1 8.6 2.5 5.5 5.6 5.5c1.9 0 3.2 1.1 4.4 2.6 1.2-1.5 2.5-2.6 4.4-2.6 3.1 0 4.5 3.1 2.93 6C19 15.65 12 20 12 20Z"
                  fill={recipe.is_favorite ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>
        </div>

        {recipe.cover_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.cover_image_url}
            alt=""
            className="mt-5 aspect-[16/10] w-full rounded-[28px] object-cover shadow-[0px_20px_50px_rgba(0,0,0,0.12)]"
          />
        )}

        <h1
          dir={dirFor(recipe.title)}
          className="mt-6 text-center text-3xl leading-tight"
        >
          {recipe.title}
        </h1>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm font-semibold text-muted">
          {recipe.servings && <span>{recipe.servings} servings</span>}
          {recipe.total_time_min && (
            <span className="font-mono text-accent">{recipe.total_time_min} min</span>
          )}
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
          <LinkButton
            href={`/recipe/${recipe.id}/cook`}
            className="mt-6 flex w-full items-center justify-center gap-2 py-4 text-lg"
          >
            👩‍🍳 Start Cooking
          </LinkButton>
        )}

        {recipe.needs_review && (
          <div className="mt-4 rounded-2xl bg-warn-bg p-3 text-sm text-warn-text">
            We couldn&apos;t fully read this one. The link is saved — you can add
            the details yourself.
          </div>
        )}

        <section className="mt-8">
          <h2 className="text-[15px] font-bold">Shelves</h2>
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
                    className={`rounded-full px-3 py-1.5 text-sm font-semibold transition active:scale-95 ${
                      isMember
                        ? "bg-accent text-accent-ink"
                        : "bg-card text-foreground shadow-[0px_4px_14px_rgba(0,0,0,0.06)]"
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
              className="min-w-0 flex-1 rounded-full bg-card px-3 py-1.5 text-sm shadow-[0px_4px_14px_rgba(0,0,0,0.06)] outline-none"
            />
            <button
              type="submit"
              className="shrink-0 rounded-full bg-card px-3 py-1.5 text-sm font-semibold text-accent shadow-[0px_4px_14px_rgba(0,0,0,0.06)] active:scale-95"
            >
              Create
            </button>
          </form>
        </section>

        {ings.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[15px] font-bold">Ingredients</h2>
            <ul className="mt-3 space-y-2">
              {ings.map((ing) => (
                <li
                  key={ing.id}
                  dir={dirFor(ing.raw_text)}
                  className="rounded-2xl bg-card px-4 py-3 text-sm shadow-[0px_4px_14px_rgba(0,0,0,0.05)]"
                >
                  {ing.raw_text}
                </li>
              ))}
            </ul>
          </section>
        )}

        {nutritionTotals && <NutritionChips totals={nutritionTotals} />}

        {stps.length > 0 && (() => {
          // Only real instructions get numbered. "tip"s are genuine asides
          // (a serving idea, a use for leftovers) shown right after in a
          // clearly lower-emphasis style. "ignored" lines are author
          // cross-promotion the parser is fairly confident isn't part of
          // this recipe at all — kept out of the way behind a disclosure
          // rather than deleted, since the classifier is a best-effort guess.
          const instructions = stps.filter((s) => s.kind === "instruction");
          const tips = stps.filter((s) => s.kind === "tip");
          const ignored = stps.filter((s) => s.kind === "ignored");

          return (
            <section className="mt-8">
              <h2 className="text-[15px] font-bold">Steps</h2>

              {instructions.length > 0 && (
                <ol className="mt-3 space-y-3">
                  {instructions.map((step, i) => (
                    // dir goes on the flex container itself (not just the
                    // text) so the number badge and the paragraph both flip
                    // order for Hebrew — CSS flexbox's "row" axis follows the
                    // element's own direction, so this alone fixes badge
                    // placement + alignment.
                    <li
                      key={step.id}
                      dir={dirFor(step.text)}
                      className="flex gap-3 rounded-2xl bg-card px-4 py-3 shadow-[0px_4px_14px_rgba(0,0,0,0.05)]"
                    >
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink">
                        {i + 1}
                      </span>
                      <p className="text-[15px] leading-relaxed">{step.text}</p>
                    </li>
                  ))}
                </ol>
              )}

              {tips.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {tips.map((step) => (
                    <li
                      key={step.id}
                      dir={dirFor(step.text)}
                      className="flex gap-2 rounded-2xl bg-info-bg px-4 py-3"
                    >
                      <span aria-hidden className="shrink-0">
                        💡
                      </span>
                      <p className="text-sm italic leading-relaxed text-muted">
                        {step.text}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {ignored.length > 0 && (
                <details className="mt-4 text-sm text-muted">
                  <summary className="cursor-pointer select-none font-semibold">
                    Show {ignored.length} more line{ignored.length === 1 ? "" : "s"}{" "}
                    from the original source
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {ignored.map((step) => (
                      <li
                        key={step.id}
                        dir={dirFor(step.text)}
                        className="rounded-2xl bg-card px-3 py-2 shadow-[0px_4px_14px_rgba(0,0,0,0.05)]"
                      >
                        {step.text}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          );
        })()}
      </main>
      <BottomNav />
    </div>
  );
}
