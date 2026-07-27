"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteRecipeAction, type DeleteRecipeState } from "@/app/actions";
import { dirFor, type Lang } from "@/lib/lang";
import { recipeStrings, type RecipeStrings } from "@/lib/recipeStrings";

// Confirm copy lives in lib/recipeStrings.ts, in the same deadpan register as
// the home-page headlines (see lib/quotes.ts) and in both languages.
// Deliberately low-key: this is a personal recipe box, not a bank transfer,
// and a stern red "THIS CANNOT BE UNDONE" modal would be doing more emotional
// work than the situation calls for. Still says the word "gone" somewhere,
// though — the joke shouldn't cost you the recipe.

// Picked on open rather than on render: the component is server-rendered as
// part of the card list, and choosing a random line during render would make
// the server and client markup disagree (hydration mismatch). By the time
// the dialog opens we're client-only, so a fresh line every time is free.
function randomLine(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}

export function DeleteRecipe({
  recipeId,
  title,
  variant,
  lang,
}: {
  recipeId: string;
  title: string;
  /** `"icon"` is the low-hierarchy × that sits on a home-page card;
   *  `"full"` is the labelled button on the recipe detail page. */
  variant: "icon" | "full";
  /** Supplied by the recipe page so the dialog speaks the recipe's language.
   *  Omitted on the home cards, which stay English regardless of what's on
   *  them — same call as the card's own category label.
   *
   *  The language rather than the strings themselves, because RecipeStrings
   *  holds functions and functions can't cross the server/client boundary.
   *  See the note at the top of lib/recipeStrings.ts. */
  lang?: Lang;
}) {
  const t = recipeStrings(lang ?? "en");
  const [line, setLine] = useState<string | null>(null);
  const open = line !== null;
  const cancelRef = useRef<HTMLButtonElement>(null);

  // On success the action redirects and this component goes away, so `state`
  // only ever holds a value when the delete actually failed — which is the
  // one case that used to produce a silent reload and no deleted recipe.
  const [state, formAction] = useActionState<DeleteRecipeState, FormData>(
    deleteRecipeAction,
    { message: null },
  );

  // Escape to dismiss, and don't let the page behind the dialog scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLine(null);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus lands on Cancel, not Delete — the destructive button should
    // never be one stray Enter away. `preventScroll` so focusing it can't
    // shift the page behind the dialog (same reason as NutritionSource).
    cancelRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          // The card is a <Link>; this button is a sibling layered over it
          // rather than a descendant, because a <button> inside an <a> is
          // invalid HTML and taps land on whichever the browser feels like.
          // stopPropagation is still needed for the overlay case.
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setLine(randomLine(t.deleteLines));
          }}
          aria-label={`Delete ${title}`}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/50 bg-black/35 text-[15px] leading-none text-white/90 backdrop-blur-md transition hover:bg-black/55 active:scale-90"
        >
          <span aria-hidden className="-mt-px">
            ×
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setLine(randomLine(t.deleteLines))}
          className="w-full rounded-full border border-border px-4 py-3 font-heading text-[15px] font-semibold text-muted transition active:scale-[0.98] hover:border-warn-text/40 hover:text-warn-text"
        >
          {t.deleteRecipe}
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.deleteRecipe}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-5 pb-8 backdrop-blur-[2px] sm:items-center sm:pb-0"
          onClick={() => setLine(null)}
        >
          <div
            // Stops a click inside the sheet from reaching the backdrop's
            // dismiss handler.
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-[28px] bg-card p-6 shadow-[0px_24px_60px_rgba(0,0,0,0.25)]"
          >
            <h2 className="text-xl leading-snug">{line}</h2>
            {/* The title is recipe content, so it keeps its own direction
                even inside a dialog that has already taken the recipe's. The
                conjunction lives in the blurb string rather than in the JSX:
                Hebrew attaches it to the following word (״וכל מה שבתוכו״) and
                has no separate token to sit here. */}
            <p className="mt-2 text-sm text-muted">
              <span dir={dirFor(title)} className="font-semibold text-foreground">
                {title}
              </span>{" "}
              {t.deleteBlurb}
            </p>

            {state.message && (
              <p
                role="alert"
                className="mt-4 rounded-2xl bg-warn-bg px-4 py-3 text-sm font-semibold text-warn-text"
              >
                {state.message}
              </p>
            )}

            <div className="mt-6 flex gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => setLine(null)}
                className="flex-1 rounded-full bg-button-inactive-bg px-4 py-3 font-heading font-semibold text-foreground transition active:scale-[0.98]"
              >
                {t.keepIt}
              </button>
              <form action={formAction} className="flex-1">
                <input type="hidden" name="recipe_id" value={recipeId} />
                <ConfirmButton t={t} />
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ConfirmButton({ t }: { t: RecipeStrings }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-full bg-warn-text px-4 py-3 font-heading font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
    >
      {pending ? t.deleting : t.confirmDelete}
    </button>
  );
}
