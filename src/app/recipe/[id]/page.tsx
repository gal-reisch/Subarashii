import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { BottomNav } from "@/components/BottomNav";
import { HeartIcon } from "@/components/HeartIcon";
import { LinkButton } from "@/components/Button";
import { DeleteRecipe } from "@/components/DeleteRecipe";
import { NutritionChips } from "@/components/NutritionChips";
import { RetryImport } from "@/components/RetryImport";
import { setServingsAction, toggleFavoriteAction } from "@/app/actions";
import { createCollectionAction, toggleRecipeInCollectionAction } from "@/app/collections/actions";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { dirFor } from "@/lib/lang";
import { computeNutritionTotals } from "@/lib/nutritionCalc";
import { mergeUnclosedParens } from "@/lib/parser/mergeSteps";
import { classifyStepKind } from "@/lib/parser/stepKind";
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

  // NOTE: deliberately no container-level `dir` here. An earlier pass set
  // dir on <main> for Hebrew recipes, which mirrored the entire layout —
  // headings, back button, flex order. The app's UI is English and stays
  // LTR no matter what language a recipe is in; only the recipe's own text
  // flows RTL, via the per-line `dirFor` calls below. Layout LTR, text
  // per-line — that rule holds across the whole app.
  //
  // See lib/imageUrl.ts — unwraps a stored Google-Images result link so an
  // already-saved recipe stops rendering a broken-image icon.
  const coverImageUrl = normalizeImageUrl(recipe.cover_image_url);

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
              <HeartIcon filled={!!recipe.is_favorite} />
            </button>
          </form>
        </div>

        {coverImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImageUrl}
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
            {/* Instagram in particular fails intermittently, so the same link
                read a second time very often works. Only offered when there's
                a URL to re-read. */}
            {recipe.source_url && <RetryImport recipeId={recipe.id} />}
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

        {nutritionTotals && (
          <NutritionChips
            totals={nutritionTotals}
            servings={recipe.servings}
            servingsControl={
              <ServingsControl recipeId={recipe.id} servings={recipe.servings} />
            }
          />
        )}

        {stps.length > 0 && (() => {
          // Only real instructions get numbered. "tip"s are genuine asides
          // (a serving idea, a use for leftovers) shown right after in a
          // clearly lower-emphasis style. "ignored" lines are author
          // cross-promotion the parser is fairly confident isn't part of
          // this recipe at all — kept out of the way behind a disclosure
          // rather than deleted, since the classifier is a best-effort guess.
          // Classified from the text on every render rather than read from
          // the stored `kind` column. That column is only written at save
          // time, so recipes saved before the classifier shipped have every
          // row marked "instruction" — which is why a recipe like the crème
          // brûlée one numbered "click here for my meringue recipe" as step
          // 14. Deriving here applies the current rules retroactively to the
          // whole box, with no migration or backfill.
          // Same reasoning applies to steps torn in half mid-parenthetical:
          // the parser only stopped doing that recently, so stitch stored
          // rows back together here rather than migrating the table. Keeps
          // the first row's id and whichever timer was detected first.
          const whole = mergeUnclosedParens(
            stps,
            (s) => s.text,
            (prev, next) => ({
              ...prev,
              text: `${prev.text} ${next.text}`,
              detected_timer_seconds:
                prev.detected_timer_seconds ?? next.detected_timer_seconds,
            }),
          );
          const classified = whole.map((s) => ({ ...s, kind: classifyStepKind(s.text) }));
          const instructions = classified.filter((s) => s.kind === "instruction");
          const tips = classified.filter((s) => s.kind === "tip");
          const ignored = classified.filter((s) => s.kind === "ignored");

          return (
            <section className="mt-8">
              <h2 className="text-[15px] font-bold">Steps</h2>

              {instructions.length > 0 && (
                <ol className="mt-3 space-y-3">
                  {instructions.map((step, i) => (
                    // `dir` on the <p> only. The number badge is UI chrome and
                    // stays on the left for every language; only the step text
                    // itself flows RTL.
                    <li
                      key={step.id}
                      className="flex gap-3 rounded-2xl bg-card px-4 py-3 shadow-[0px_4px_14px_rgba(0,0,0,0.05)]"
                    >
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink">
                        {i + 1}
                      </span>
                      <p dir={dirFor(step.text)} className="min-w-0 flex-1 text-[15px] leading-relaxed">
                        {step.text}
                      </p>
                    </li>
                  ))}
                </ol>
              )}

              {tips.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {tips.map((step) => (
                    <li key={step.id} className="flex gap-2 rounded-2xl bg-info-bg px-4 py-3">
                      <span aria-hidden className="shrink-0">
                        💡
                      </span>
                      <p
                        dir={dirFor(step.text)}
                        className="min-w-0 flex-1 text-sm italic leading-relaxed text-muted"
                      >
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

        {/* Full-hierarchy delete, at the very bottom — past the point where
            anyone is still reading the recipe, which is where a destructive
            action belongs. The home-page card carries the same action as a
            small ×; both open the same confirm dialog. */}
        <section className="mt-12">
          <DeleteRecipe recipeId={recipe.id} title={recipe.title} variant="full" />
        </section>
      </main>
      <BottomNav />
    </div>
  );
}

// Sets how many portions the recipe makes, which is what lets the nutrition
// panel divide totals down to a per-serving figure. Two presentations of one
// plain <form> — no client JS:
//
//   - Unknown yield: an amber callout, because this is the state where the
//     nutrition numbers above are whole-recipe and easy to misread.
//   - Known yield: a quiet inline correction, since the header already says
//     "makes N" and the user only comes here to disagree with it.
function ServingsControl({
  recipeId,
  servings,
}: {
  recipeId: string;
  servings: number | null;
}) {
  const unknown = servings == null;

  return (
    <form
      action={setServingsAction}
      className={`mt-3 flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2.5 text-sm ${
        unknown ? "bg-warn-bg text-warn-text" : "text-muted"
      }`}
    >
      <input type="hidden" name="recipe_id" value={recipeId} />
      <label htmlFor="servings" className="font-semibold">
        {unknown
          ? "This one never said how many it feeds. How many?"
          : "Serves"}
      </label>
      <input
        id="servings"
        name="servings"
        type="number"
        min={1}
        max={100}
        defaultValue={servings ?? ""}
        placeholder="—"
        className="w-16 rounded-full border border-accent bg-white px-3 py-1 text-center font-mono text-sm text-foreground outline-none focus:shadow-[0px_0px_0px_2px_var(--accent)]"
      />
      <button
        type="submit"
        className="rounded-full bg-accent px-3 py-1 font-heading text-sm font-semibold text-accent-ink transition active:scale-95"
      >
        {unknown ? "Split it up" : "Update"}
      </button>
    </form>
  );
}
