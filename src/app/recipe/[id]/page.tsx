import { notFound } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { BottomNav } from "@/components/BottomNav";
import { FavoriteButton } from "@/components/FavoriteButton";
import { LinkButton } from "@/components/Button";
import { DeleteRecipe } from "@/components/DeleteRecipe";
import { NutritionChips } from "@/components/NutritionChips";
import { NutritionSource } from "@/components/NutritionSource";
import { RetryImport } from "@/components/RetryImport";
import { ShelfPicker } from "@/components/ShelfPicker";
import { setServingsAction } from "@/app/actions";
import { normalizeImageUrl } from "@/lib/imageUrl";
import { dirFor, recipeLang } from "@/lib/lang";
import { recipeStrings, type RecipeStrings } from "@/lib/recipeStrings";
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
  /** Which table answered for this row — read only by the "where do these
   *  numbers come from" dialog, which is the whole reason it's selected. */
  fdc_source: string | null;
  grams_resolved: number | null;
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
        .select(
          "id,raw_text,calories,protein_g,carbs_g,fat_g,fiber_g,sugar_g,is_estimated,fdc_source,grams_resolved",
        )
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

  // The recipe body — everything from the cover image down — is presented in
  // the recipe's own language and direction. The page's chrome above it (back
  // button, shelf picker, favourite toggle) and the bottom nav stay English
  // and LTR.
  //
  // This narrows the earlier rule rather than abandoning it. That rule ("no
  // container-level dir; only per-line dirFor") existed because an even
  // earlier pass had put `dir` on <main> and mirrored the back button and nav
  // along with it. But swinging fully the other way left the frame fighting
  // its contents: "Ingredients" and "Steps" sat hard left above perfectly
  // right-aligned Hebrew, and the "6 servings · 720 min · Source" meta row
  // ran the opposite way from the title directly above it. Half-mirrored read
  // as broken rather than as neutral.
  //
  // So the boundary is now content vs. chrome instead of recipe-text vs.
  // everything. Per-line `dirFor` stays exactly where it was — it's what
  // handles a Latin ingredient inside a Hebrew list, which the container
  // direction can't.
  const lang = recipeLang(recipe.primary_language, [
    recipe.title,
    ...ings.map((i) => i.raw_text),
    ...stps.map((s) => s.text),
  ]);
  const t = recipeStrings(lang);
  const bodyDir = lang === "he" ? "rtl" : "ltr";

  // See lib/imageUrl.ts — unwraps a stored Google-Images result link so an
  // already-saved recipe stops rendering a broken-image icon.
  const coverImageUrl = normalizeImageUrl(recipe.cover_image_url);

  return (
    <div className="min-h-full">
      <main className="mx-auto max-w-2xl px-5 pb-32 pt-6">
        <div className="flex items-center justify-between">
          <BackButton href="/" label="Back to the box" />
          {/* The two "where does this belong" controls, side by side. Shelves
              used to be a full labelled section under Start Cooking; it does
              the same job as the heart at a fraction of the frequency, so it
              sits next to it instead of taking a slab of the page.

              The favorite toggle still submits a plain form to the same
              Server Action; it's a client component only so it can throw the
              emoji burst from the point of the tap. `recipe.is_favorite` is
              undefined until migration 0005 is applied; treat that as
              not-favorited. */}
          <div className="flex items-center gap-1">
            <ShelfPicker
              recipeId={recipe.id}
              shelves={cols}
              memberIds={[...memberIds]}
            />
            <FavoriteButton recipeId={recipe.id} isFavorite={!!recipe.is_favorite} />
          </div>
        </div>

        {/* Everything below here is the recipe, so it takes the recipe's own
            direction and language. The chrome above keeps the app's. */}
        <div dir={bodyDir}>
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
          {recipe.servings && <span>{t.servings(recipe.servings)}</span>}
          {recipe.total_time_min && (
            <span className="font-mono text-accent">{t.minutes(recipe.total_time_min)}</span>
          )}
          {/* Cuisine is free text off the source, so it carries whatever
              language it was written in rather than the body's. */}
          {recipe.cuisine && <span dir={dirFor(recipe.cuisine)}>{recipe.cuisine}</span>}
          {recipe.source_url && (
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              {t.source}
            </a>
          )}
        </div>

        {(ings.length > 0 || stps.length > 0) && (
          // Dropped a level in the hierarchy: this used to be a full-width
          // py-4 text-lg primary pill with a chef emoji, which made it the
          // loudest thing on the page — louder than the title and than the
          // ingredients you actually came to read. It's a doorway to another
          // screen, not the point of this one, so it's now an inline-sized
          // pill that centres under the meta row. The emoji went with it; it
          // was doing decoration, not meaning.
          //
          // Quiet, but not *grey*. The first pass at that used `secondary`,
          // which is Figma's inactive state — grey text on grey fill, which is
          // also exactly what a disabled control looks like, so the button
          // read as switched off. `soft` keeps the drop in hierarchy (the size
          // is doing most of that work anyway) while staying visibly pressable.
          <div className="mt-5 flex justify-center">
            <LinkButton
              href={`/recipe/${recipe.id}/cook`}
              variant="soft"
              className="px-5 py-2.5 text-sm"
            >
              {t.startCooking}
            </LinkButton>
          </div>
        )}

        {recipe.needs_review && (
          <div className="mt-4 rounded-2xl bg-warn-bg p-3 text-sm text-warn-text">
            {t.needsReview}
            {/* Instagram in particular fails intermittently, so the same link
                read a second time very often works. Only offered when there's
                a URL to re-read. */}
            {recipe.source_url && <RetryImport recipeId={recipe.id} />}
          </div>
        )}

        {ings.length > 0 && (
          <section className="mt-8">
            <h2 className="text-[15px] font-bold">{t.ingredients}</h2>
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
            strings={t}
            servingsControl={
              <ServingsControl recipeId={recipe.id} servings={recipe.servings} strings={t} />
            }
            estimatedChip={
              <NutritionSource
                rows={ings}
                // Passed only when the totals really are per-serving, so the
                // dialog's "divided by N" line can't claim a division that
                // computeNutritionTotals didn't do.
                servings={nutritionTotals.perServing ? recipe.servings : null}
                lang={lang}
              />
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
              <h2 className="text-[15px] font-bold">{t.steps}</h2>

              {instructions.length > 0 && (
                <ol className="mt-3 space-y-3">
                  {instructions.map((step, i) => (
                    // `dir` goes on the <li>, not just the text, so the number
                    // badge mirrors with it. An earlier pass pinned the badge
                    // to the left on the grounds that it's UI chrome — but on
                    // a Hebrew step that leaves the "1" stranded at the far
                    // left with the text starting at the far right and a lake
                    // of white space between them. The number labels the step,
                    // so it belongs where the step starts reading.
                    //
                    // This does not walk back the app-is-LTR rule (task #25):
                    // the scope is one row, and everything around it — the
                    // "Steps" heading, the page, the nav — stays LTR.
                    <li
                      key={step.id}
                      dir={dirFor(step.text)}
                      className="flex gap-3 rounded-2xl bg-card px-4 py-3 shadow-[0px_4px_14px_rgba(0,0,0,0.05)]"
                    >
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-ink">
                        {i + 1}
                      </span>
                      <p className="min-w-0 flex-1 text-[15px] leading-relaxed">
                        {step.text}
                      </p>
                    </li>
                  ))}
                </ol>
              )}

              {tips.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {tips.map((step) => (
                    // Same reasoning as the numbered steps above: the 💡 leads
                    // the line, so it follows the line's direction.
                    <li
                      key={step.id}
                      dir={dirFor(step.text)}
                      className="flex gap-2 rounded-2xl bg-info-bg px-4 py-3"
                    >
                      <span aria-hidden className="shrink-0">
                        💡
                      </span>
                      <p className="min-w-0 flex-1 text-sm italic leading-relaxed text-muted">
                        {step.text}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {ignored.length > 0 && (
                <details className="mt-4 text-sm text-muted">
                  <summary className="cursor-pointer select-none font-semibold">
                    {t.showMore(ignored.length)}
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
          <DeleteRecipe
            recipeId={recipe.id}
            title={recipe.title}
            variant="full"
            lang={lang}
          />
        </section>
        </div>
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
  strings,
}: {
  recipeId: string;
  servings: number | null;
  strings: RecipeStrings;
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
        {unknown ? strings.servingsUnknown : strings.serves}
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
        {unknown ? strings.setServings : strings.updateServings}
      </button>
    </form>
  );
}
