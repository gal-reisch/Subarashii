"use client";

import { useEffect, useRef, useState } from "react";
import { dirFor, type Lang } from "@/lib/lang";
import { recipeStrings, type RecipeStrings } from "@/lib/recipeStrings";

// "Estimated" used to be a flat amber chip that said a thing and then refused
// to elaborate. It's the one label on the page that admits the numbers might
// be wrong, so it's exactly the label that owes an explanation — the user's
// ask was to be able to open it and see *which* ingredient was guessed at and
// what it was checked against.
//
// Everything shown here is already in the database; nothing is recomputed for
// display. `fdc_source` records which table answered for each ingredient and
// `grams_resolved` records the weight its numbers describe, both written at
// import time by lib/nutrition/match.ts. So this dialog is a read of the
// actual provenance rather than a plausible-sounding story about it, which
// matters: a made-up methodology blurb would be worse than no dialog.

export interface SourceRow {
  id: string;
  raw_text: string;
  calories: number | null;
  grams_resolved: number | null;
  fdc_source: string | null;
  is_estimated: boolean;
}

export function NutritionSource({
  rows,
  servings,
  lang,
}: {
  rows: SourceRow[];
  /** Non-null only when the totals are per-serving. */
  servings: number | null;
  /** The recipe's language, not the strings themselves: RecipeStrings holds
   *  functions, and functions can't be serialized across the server/client
   *  boundary. See the note at the top of lib/recipeStrings.ts. */
  lang: Lang;
}) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const strings = recipeStrings(lang);
  const t = strings.sourceDialog;

  // Same dialog mechanics as DeleteRecipe: Escape closes, the page behind
  // doesn't scroll, focus lands inside.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // The sheet, not a button inside it — a focused button gets the browser's
    // focus ring drawn on it, which reads as a rendering fault to anyone who
    // opened this by tapping. See the longer note in DeleteRecipe.tsx.
    //
    // `preventScroll` matters extra here: this sheet is taller than the
    // viewport, and focusing something inside it scrolls that thing into view,
    // so the dialog used to open part-scrolled with the user landing below its
    // title and method paragraph — the two things it exists to say.
    sheetRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Only explain the sources this recipe actually used. A recipe with no
  // Tzameret rows shouldn't get a paragraph about Tzameret — the point is to
  // account for these numbers, not to document the pipeline.
  const used = new Set(
    rows.map((r) => (r.is_estimated ? "estimate" : (r.fdc_source ?? "none"))),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.title}
        className="ms-auto flex items-center gap-1 rounded-full bg-warn-bg px-2 py-0.5 text-[10px] font-bold text-warn-text transition active:scale-95"
      >
        {strings.estimated}
        {/* The (i) is the whole affordance — the chip is otherwise identical
            to the static label it replaced, and a chip that looks like a
            label doesn't get tapped. Kept to a hairline circle at the chip's
            own text size so it reads as a footnote marker rather than as a
            second, competing control. */}
        <span
          aria-hidden
          className="flex h-3 w-3 items-center justify-center rounded-full border border-current text-[8px] leading-none"
        >
          i
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.title}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-4 pb-4 backdrop-blur-[2px] sm:items-center sm:pb-0"
          onClick={() => setOpen(false)}
        >
          <div
            ref={sheetRef}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-[28px] bg-card p-6 shadow-[0px_24px_60px_rgba(0,0,0,0.25)] outline-none"
          >
            <h2 className="text-xl leading-snug">{t.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">{t.method}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {servings ? t.perServingNote(servings) : t.wholeRecipeNote}
            </p>

            <ul className="mt-5 space-y-1.5">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="flex items-baseline gap-2 rounded-2xl bg-background px-3 py-2 text-sm"
                >
                  {/* Wraps rather than truncates. The whole point of the row
                      is to say which ingredient a number came from, and
                      "1.5 ק״ג אסאדו (שפודרה) ע…" doesn't say it — the part
                      that got cut is the part being accounted for. */}
                  <span dir={dirFor(row.raw_text)} className="min-w-0 flex-1">
                    {row.raw_text}
                  </span>
                  {/* `dir` only in the numeric case: "1500 g" is a value/unit
                      pair and inverts to "g 1500" if it inherits the dialog's
                      RTL, but the fallback is a Hebrew sentence
                      ("משקל לא ידוע") that must keep the dialog's direction. */}
                  <span
                    dir={row.grams_resolved != null ? "ltr" : undefined}
                    className="shrink-0 font-mono text-[11px] text-muted"
                  >
                    {row.grams_resolved != null
                      ? `${Math.round(row.grams_resolved)} g`
                      : t.unknownWeight}
                  </span>
                  <SourceTag row={row} t={t} />
                </li>
              ))}
            </ul>

            <div className="mt-4 space-y-1.5 text-xs leading-relaxed text-muted">
              {used.has("tzameret") && <p>{t.tzameretNote}</p>}
              {used.has("usda") && <p>{t.usdaNote}</p>}
              {used.has("estimate") && <p>{t.estimateNote}</p>}
              <p>{t.caveat}</p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 w-full rounded-full bg-button-inactive-bg px-4 py-3 font-heading font-semibold text-foreground transition active:scale-[0.98]"
            >
              {t.close}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// The estimated rows are the ones the dialog exists for, so they're the only
// ones that get the warning colour. A Tzameret or USDA row is just a fact and
// is styled as quietly as possible.
function SourceTag({
  row,
  t,
}: {
  row: SourceRow;
  t: RecipeStrings["sourceDialog"];
}) {
  const estimated = row.is_estimated;
  const label = estimated
    ? t.sourceEstimate
    : row.fdc_source === "tzameret"
      ? t.sourceTzameret
      : row.fdc_source === "usda"
        ? t.sourceUsda
        : t.sourceNone;

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
        estimated ? "bg-warn-bg text-warn-text" : "bg-accent/15 text-accent-deep"
      }`}
    >
      {label}
    </span>
  );
}
