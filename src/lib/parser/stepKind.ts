// Heuristic classification of a recipe "step" line into what it actually is.
// Recipe sites/blogs often bury author asides and cross-promotion inside the
// instructions block (schema.org doesn't distinguish them), so a naive parse
// numbers "click here for my meringue recipe" right alongside "preheat the
// oven" as if they were equally load-bearing steps.
//
// Three buckets:
//  - "instruction": an actual step needed to cook the dish. Numbered normally.
//  - "tip": recipe-adjacent but optional (a serving suggestion, a use for
//    leftovers, a note) — real, worth keeping, but not part of the numbered
//    sequence. Rendered with a distinct, lower-emphasis style.
//  - "ignored": not about this recipe at all (links to the author's other
//    posts, "don't forget to subscribe", etc.) — hidden from the step list by
//    default, but never deleted, since this is a best-effort guess.
export type StepKind = "instruction" | "tip" | "ignored";

// Cross-promotion / calls-to-action — a strong signal the line isn't part of
// cooking this dish at all.
const CTA_PATTERN =
  /(לחצו כאן|קראו עוד|קרא עוד|מתכון כאן|לעוד מתכונים|עקבו אחר(י|ינו)?|הירשמו|תסגרו פינה|קישור בביו|click here|read more|link in bio|follow me|subscribe|check out my|more recipes)/i;

// Optional asides that are still genuinely related to the recipe (using a
// byproduct, a serving idea, a storage note) — real, but not a required step.
const TIP_PATTERN =
  /(אפשר להכין|ניתן להכין|אפשר גם|אפשר לשמור|מומלץ להגיש|לשרת עם|טיפ\s*:|עצה\s*:|אם רוצים|you can also|leftover|tip\s*:|note\s*:|optional\s*:|if desired|store in an? airtight)/i;

// Common imperative cooking verbs (Hebrew + English). A long line with none
// of these is unlikely to be an actual cooking instruction.
const COOKING_VERB =
  /(מחמם|מוזג|מערבב|טורפ|אופ|מניח|מוציא|מעביר|מפזר|משחימ|מגיש|קוצצ|מטגנ|מבשל|מקציפ|מקרר|מוסיפ|מכניס|חותכ|מסנן|preheat|pour|whisk|bake|place|remove|transfer|sprinkle|serve|chop|fry|cook|whip|chill|add|combine|stir|mix|heat|simmer|blend|knead)/i;

export function classifyStepKind(text: string): StepKind {
  const trimmed = text.trim();
  if (CTA_PATTERN.test(trimmed)) return "ignored";
  if (TIP_PATTERN.test(trimmed)) return "tip";
  // Fallback: a long line with no cooking verb at all reads like blog prose
  // rather than an instruction — likely filler that just didn't match a
  // known phrase above.
  if (trimmed.length > 200 && !COOKING_VERB.test(trimmed)) return "ignored";
  return "instruction";
}
