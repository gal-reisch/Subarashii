// The recipe page's own copy — headings, buttons, labels, the nutrition
// dialog. All of it English, always, and that is the whole point of the file.
//
// There used to be a Hebrew table beside this one (task #47), picked per
// recipe by `recipeLang`. It's gone. The reasoning it was built on was that
// the recipe body is content and should therefore speak the recipe's language
// down to its furniture — but a Hebrew recipe then had a Hebrew "Start
// cooking" sitting a few hundred pixels above an English delete button, and
// the app looked like it couldn't decide what language it was. The user's rule
// is simpler and it's the right one: every word the *app* says is English, in
// every recipe. Only the words the recipe itself says are in the recipe's
// language, and those come out of the database, not out of here.
//
// So the test for whether a string belongs in this file is no longer "is it
// content or chrome" — everything here is chrome. It's "does the recipe page
// say it". Nothing in here is language-dependent, there's no lookup, and
// there's deliberately no seam for a second language to be threaded back
// through: a future translation pass would have to add the mechanism as well
// as the words, which is enough friction to make it a decision rather than an
// accident.
//
// Direction is a separate question from language and is still answered per
// recipe. The body of a Hebrew recipe stays mirrored so its text reads
// correctly, which means these English labels right-align above right-aligned
// Hebrew. That's intended: the frame follows the content, the words don't.
// The exceptions — the meta row, the nutrition panel, this file's dialog — are
// forced back to LTR at their call sites, because they're pure chrome whose
// element *order* would otherwise reverse. See the note in recipe/[id]/page.tsx.
//
// Import `RECIPE_UI` directly wherever it's needed, including in client
// components. Do not pass it as a prop across the server/client boundary:
// several fields are functions (`servings`, `minutes`, `perServing`,
// `showMore`, `sourceDialog.perServingNote`), React throws "Functions cannot
// be passed directly to Client Components", and because this module is
// otherwise plain data the mistake typechecks perfectly.

export interface RecipeStrings {
  ingredients: string;
  steps: string;
  nutrition: string;
  startCooking: string;
  servings: (n: number) => string;
  minutes: (n: number) => string;
  source: string;
  needsReview: string;
  perServing: (n: number | null) => string;
  wholeRecipe: string;
  estimated: string;
  /** Accessible name for the estimated chip, which is a button. */
  estimatedHint: string;
  showMore: (n: number) => string;
  servingsUnknown: string;
  serves: string;
  setServings: string;
  updateServings: string;
  /** Copy for the "where do these numbers come from" dialog. */
  sourceDialog: {
    title: string;
    close: string;
    method: string;
    perServingNote: (n: number) => string;
    wholeRecipeNote: string;
    tableHeadIngredient: string;
    tableHeadSource: string;
    unknownWeight: string;
    /** Names for `ingredient.fdc_source`. */
    sourceTzameret: string;
    sourceUsda: string;
    sourceEstimate: string;
    sourceNone: string;
    tzameretNote: string;
    usdaNote: string;
    estimateNote: string;
    caveat: string;
  };
}

export const RECIPE_UI: RecipeStrings = {
  ingredients: "Ingredients",
  steps: "Steps",
  nutrition: "Nutrition",
  startCooking: "Start cooking",
  servings: (n) => `${n} servings`,
  minutes: (n) => `${n} min`,
  source: "Source ↗",
  needsReview:
    "We couldn't fully read this one. The link is saved — you can add the details yourself.",
  perServing: (n) => (n ? `per serving · makes ${n}` : "per serving"),
  wholeRecipe: "whole recipe",
  estimated: "Estimated",
  estimatedHint: "How this was worked out",
  showMore: (n) =>
    `Show ${n} more line${n === 1 ? "" : "s"} from the original source`,
  servingsUnknown: "This one never said how many it feeds. How many?",
  serves: "Serves",
  setServings: "Split it up",
  updateServings: "Update",
  sourceDialog: {
    title: "Where these numbers come from",
    close: "Close",
    method:
      "Each ingredient line is read for a quantity and a food, converted to grams, then looked up in a food composition table and scaled to that weight. The recipe's totals are the sum of the rows below.",
    perServingNote: (n) => `Totals are divided by ${n} servings.`,
    wholeRecipeNote:
      "This recipe never said how many it makes, so the totals are for the whole thing, not a portion.",
    tableHeadIngredient: "Ingredient",
    tableHeadSource: "Source",
    unknownWeight: "weight unknown",
    sourceTzameret: "Tzameret",
    sourceUsda: "USDA",
    sourceEstimate: "Estimated",
    sourceNone: "No data",
    tzameretNote: "Israeli Ministry of Health national nutrient database.",
    usdaNote: "USDA FoodData Central.",
    estimateNote:
      "No table match, so these came from an AI estimate of the line as written. That's what the Estimated label is warning you about.",
    caveat:
      "Weights are of the raw ingredients, so nothing here accounts for water cooked off. Treat it as a good ballpark, not a measurement.",
  },
};
