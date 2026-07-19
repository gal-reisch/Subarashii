// Heuristic splitter for free-form recipe text (OCR output, pasted blocks,
// social captions). Best-effort — the result is always user-editable.

const ING_HEADER = /^(ingredients?|מצרכים|רכיבים|חומרים)\s*:?\s*$/i;
const STEP_HEADER =
  /^(instructions?|directions?|method|preparation|steps?|הוראות|אופן ההכנה|אופן הכנה|אופן|הכנה)\s*:?\s*$/i;
const QUANTITY = /^\s*(\d+([.,/]\d+)?|½|¼|¾|⅓|⅔|⅛)\s*\S/;
const LEADING_STEP_NUM = /^\s*\d+[.)]\s+/;

export interface SplitText {
  title: string;
  ingredients: string[];
  steps: string[];
}

export function splitFreeText(input: string): SplitText {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { title: "Saved recipe", ingredients: [], steps: [] };
  }

  const title = lines[0].length <= 90 ? lines[0] : "Saved recipe";
  const body = lines[0].length <= 90 ? lines.slice(1) : lines;

  const ingredients: string[] = [];
  const steps: string[] = [];
  const hasHeaders = body.some((l) => ING_HEADER.test(l) || STEP_HEADER.test(l));
  let mode: "unknown" | "ing" | "step" = "unknown";

  for (const line of body) {
    if (ING_HEADER.test(line)) {
      mode = "ing";
      continue;
    }
    if (STEP_HEADER.test(line)) {
      mode = "step";
      continue;
    }

    if (mode === "ing") {
      ingredients.push(line);
    } else if (mode === "step") {
      steps.push(line.replace(LEADING_STEP_NUM, ""));
    } else if (!hasHeaders) {
      // No section markers: quantity-led or short lines look like ingredients;
      // sentence-like lines look like steps.
      const looksIngredient =
        QUANTITY.test(line) || (line.length < 45 && !/[.!?]$/.test(line));
      if (looksIngredient) ingredients.push(line);
      else steps.push(line.replace(LEADING_STEP_NUM, ""));
    } else {
      // Headers exist but we're before the first one — treat as steps.
      steps.push(line.replace(LEADING_STEP_NUM, ""));
    }
  }

  return { title, ingredients, steps };
}
