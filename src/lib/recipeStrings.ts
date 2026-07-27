import type { Lang } from "./lang";

// UI copy for the *inside* of a recipe — the part of the app that belongs to
// the recipe rather than to the app.
//
// This is a deliberate, narrow exception to the app-is-LTR rule (task #25),
// which still holds everywhere else: the bottom nav, the back button, the
// shelf picker, the home page and the add flow are English and left-to-right
// no matter what language a recipe is in. The rule was there to stop the
// whole product mirroring itself around one Hebrew title, and it should be.
//
// But it produced a page that was half-mirrored and read as broken: every
// ingredient and step correctly right-aligned, with "Ingredients" and "Steps"
// stranded at the far left above them, and a "6 servings · Source" meta row
// running the opposite way from the title it described. The text direction
// was right and the frame around it was wrong.
//
// So the boundary moves from "the whole app is LTR" to "the app is LTR, the
// recipe is in its own language". Everything from the cover image down to the
// delete button flips together and speaks Hebrew; everything above and around
// it does not. That's the line the user drew, and it's a coherent one: the
// recipe body is content, the chrome is furniture.
//
// Passing these around: give a component the `Lang` and let it call
// `recipeStrings()` itself. Do NOT pass a `RecipeStrings` object as a prop to a
// client component — several fields are functions (`servings`, `minutes`,
// `perServing`, `showMore`, `sourceDialog.perServingNote`), and functions can't
// be serialized across the server/client boundary. React throws "Functions
// cannot be passed directly to Client Components", the recipe page renders the
// error boundary, and because this module is otherwise plain data the mistake
// typechecks perfectly. Server components may hold a `RecipeStrings` freely;
// only the boundary is the problem.
//
// Not translated on purpose: the nutrition *flag* pills on the home cards and
// the category labels there. Those stay English even on a Hebrew card — see
// the RTL card note in RecipeBrowser.tsx, which is the same call made for the
// same reason (card chrome, not content).

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
  deleteRecipe: string;
  servingsUnknown: string;
  serves: string;
  setServings: string;
  updateServings: string;
  /** Per-nutrient labels for the stat grid, keyed by NUTRIENT_DEFS.key. */
  nutrients: Record<string, string>;
  /** Qualitative flag pills, keyed by the English flagLabel in NUTRIENT_DEFS
   *  so the shared classification logic stays language-free. */
  flags: Record<string, string>;
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
  /** Delete confirmation, shown from the button at the bottom of the body. */
  deleteLines: string[];
  deleteBlurb: string;
  keepIt: string;
  confirmDelete: string;
  deleting: string;
}

const en: RecipeStrings = {
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
  showMore: (n) => `Show ${n} more line${n === 1 ? "" : "s"} from the original source`,
  deleteRecipe: "Delete recipe",
  servingsUnknown: "This one never said how many it feeds. How many?",
  serves: "Serves",
  setServings: "Split it up",
  updateServings: "Update",
  nutrients: {
    calories: "Calories",
    protein_g: "Protein",
    carbs_g: "Carbs",
    fat_g: "Fat",
    fiber_g: "Fiber",
    sugar_g: "Sugar",
  },
  flags: {
    "High Protein": "High Protein",
    "High Fat": "High Fat",
    "High Fiber": "High Fiber",
    "High Sugar": "High Sugar",
  },
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
  deleteLines: [
    "Straight to the bin, this one?",
    "We never speak of this recipe again?",
    "Delete it? It can't be un-deleted. Just so we're all clear.",
    "This one's had a good run. Send it off?",
    "Say the word and it's gone. Forever. No takebacks.",
    "Are we breaking up with this recipe?",
    "It's not you, it's the recipe. Delete it?",
    "Deleting this. Last chance to change your mind.",
    "Off it goes. You sure?",
    "This recipe is about to stop existing. Cool?",
  ],
  deleteBlurb: "and everything in it — ingredients, steps, shelves.",
  keepIt: "Keep it",
  confirmDelete: "Delete",
  deleting: "Deleting…",
};

// Hebrew. Written in the same register as the English — plain, a bit dry, no
// exclamation marks — rather than translated word for word. Cooking verbs are
// in the impersonal plural ("מוסיפים", "מחלקים") because that's how Hebrew
// recipes are written, and the app should sound like the recipes in it.
const he: RecipeStrings = {
  ingredients: "מצרכים",
  steps: "אופן ההכנה",
  nutrition: "ערכים תזונתיים",
  startCooking: "מתחילים לבשל",
  servings: (n) => `${n} מנות`,
  minutes: (n) => `${n} דק׳`,
  source: "מקור ↗",
  needsReview: "לא הצלחנו לקרוא את המתכון במלואו. הקישור נשמר — אפשר להשלים את הפרטים ידנית.",
  perServing: (n) => (n ? `למנה · יוצא ${n} מנות` : "למנה"),
  wholeRecipe: "כל המתכון",
  estimated: "הערכה",
  estimatedHint: "איך חושבו הערכים",
  showMore: (n) => (n === 1 ? "הצגת שורה נוספת מהמקור" : `הצגת ${n} שורות נוספות מהמקור`),
  deleteRecipe: "מחיקת המתכון",
  servingsUnknown: "לא כתוב כאן לכמה מנות זה יוצא. לכמה?",
  serves: "יוצא",
  setServings: "לחלק",
  updateServings: "עדכון",
  nutrients: {
    calories: "קלוריות",
    protein_g: "חלבון",
    carbs_g: "פחמימות",
    fat_g: "שומן",
    fiber_g: "סיבים",
    sugar_g: "סוכר",
  },
  flags: {
    "High Protein": "עתיר חלבון",
    "High Fat": "עתיר שומן",
    "High Fiber": "עתיר סיבים",
    "High Sugar": "עתיר סוכר",
  },
  sourceDialog: {
    title: "מאיפה המספרים האלה",
    close: "סגירה",
    method:
      "מכל שורת מצרך נשלפים הכמות והמצרך עצמו, הכמות מומרת לגרמים, והמצרך מחופש בטבלת הרכב מזון ומותאם למשקל הזה. הסכום של השורות למטה הוא הערכים של המתכון.",
    perServingNote: (n) => `הסכומים מחולקים ל־${n} מנות.`,
    wholeRecipeNote: "המתכון לא ציין לכמה מנות הוא יוצא, ולכן הערכים הם לכל המתכון ולא למנה.",
    tableHeadIngredient: "מצרך",
    tableHeadSource: "מקור",
    unknownWeight: "משקל לא ידוע",
    sourceTzameret: "צמרת",
    sourceUsda: "USDA",
    sourceEstimate: "הערכה",
    sourceNone: "אין נתונים",
    tzameretNote: "מאגר צמרת — מאגר הרכב המזון הלאומי של משרד הבריאות.",
    usdaNote: "‏USDA FoodData Central, מאגר הרכב המזון של משרד החקלאות האמריקאי.",
    estimateNote:
      "לא נמצאה התאמה באף טבלה, ולכן הערכים האלה הם הערכה של מודל שפה לשורה כפי שנכתבה. על זה בדיוק מתריע התג ״הערכה״.",
    caveat:
      "המשקלים הם של המצרכים הגולמיים, כך שאין כאן התחשבות בנוזלים שמתאדים בבישול. זה סדר גודל טוב, לא מדידה.",
  },
  deleteLines: [
    "ישר לפח, המתכון הזה?",
    "לא מדברים עליו יותר לעולם?",
    "למחוק? אי אפשר להחזיר אחר כך. רק שיהיה ברור.",
    "היה לו מהלך יפה. לשלוח אותו?",
    "מילה אחת והוא נעלם. לתמיד.",
    "נפרדים מהמתכון הזה?",
    "זה לא אתם, זה המתכון. למחוק?",
    "הולך להימחק. הזדמנות אחרונה להתחרט.",
    "המתכון הזה עומד להפסיק להתקיים. בסדר?",
  ],
  deleteBlurb: "וכל מה שבתוכו — מצרכים, שלבים, מדפים.",
  keepIt: "משאירים",
  confirmDelete: "מחיקה",
  deleting: "מוחק…",
};

const STRINGS: Record<Lang, RecipeStrings> = { en, he };

export function recipeStrings(lang: Lang): RecipeStrings {
  return STRINGS[lang];
}
