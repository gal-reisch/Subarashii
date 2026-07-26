// Re-joining step fragments that a sentence-boundary split tore in half.
//
// Instruction text arrives as one blob and gets split on ". " boundaries. That
// split can't tell that the "." in
//
//   "…(this is called a water bath or bain-marie. Be careful the water
//    doesn't get into the ramekins)"
//
// sits *inside* a parenthetical, so it emits two half-steps — one ending with
// a dangling "(" still open, the next ending with a stray ")". Carrying the
// open-paren depth across segments stitches them back together, and leaves any
// step whose parentheses are already balanced completely untouched.
//
// This lives in its own module rather than inside `jsonld.ts` because it's
// needed in two places at two different times:
//
//   1. At parse time, on raw strings, so newly-saved recipes are stored whole.
//   2. At *render* time, on step rows already in the database, so recipes
//      saved before the parse-time fix shipped are repaired too — same
//      derive-don't-migrate approach used for step classification. Without
//      this, the crème brûlée recipe keeps showing its bain-marie note as two
//      broken steps forever unless the user re-saves it.

/**
 * How many parentheses are still open at the end of a string.
 *
 * Never goes negative: a stray closing paren (common when the *previous*
 * fragment already got merged, or when an author just typos one) must not make
 * a balanced string look "over-closed" and start swallowing the steps after it.
 */
export function openParenDepth(s: string): number {
  let depth = 0;
  for (const ch of s) {
    if (ch === "(") depth += 1;
    else if (ch === ")" && depth > 0) depth -= 1;
  }
  return depth;
}

/**
 * Merge each item into its predecessor while that predecessor has an unclosed
 * parenthesis.
 *
 * Generic over the item type so the same rule applies to raw strings at parse
 * time and to full step rows at render time. `getText` reads the text off an
 * item; `merge` builds the combined item (letting the caller decide what to do
 * with the non-text fields — keep the first row's id, the first timer, etc.).
 */
export function mergeUnclosedParens<T>(
  items: T[],
  getText: (item: T) => string,
  merge: (prev: T, next: T) => T,
): T[] {
  const out: T[] = [];
  for (const item of items) {
    const prev = out[out.length - 1];
    if (prev !== undefined && openParenDepth(getText(prev)) > 0) {
      out[out.length - 1] = merge(prev, item);
    } else {
      out.push(item);
    }
  }
  return out;
}

/** String specialization — the parse-time case. */
export function mergeUnclosedParenStrings(parts: string[]): string[] {
  return mergeUnclosedParens(
    parts,
    (s) => s,
    (prev, next) => `${prev} ${next}`,
  );
}
