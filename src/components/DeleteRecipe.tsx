"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import { deleteRecipeAction, type DeleteRecipeState } from "@/app/actions";
import { dirFor } from "@/lib/lang";

// Deliberately low-key copy: this is a personal recipe box, not a bank
// transfer, and a stern red "THIS CANNOT BE UNDONE" modal would be doing more
// emotional work than the situation calls for. Still says the word "gone"
// somewhere, though — the joke shouldn't cost you the recipe.
//
// English only, and the strings live here rather than in lib/recipeStrings.ts
// with the rest of the recipe copy. Task #47 moved the boundary so that a
// Hebrew recipe brings its own language to everything from the cover image
// down; this dialog was inside that boundary and shouldn't have been. It
// isn't part of the recipe — it's the app asking whether you meant to throw
// something away, in the app's own voice, and a Hebrew recipe is no more
// reason to ask in Hebrew than a Hebrew recipe is a reason to relabel the
// bottom nav. Keeping the strings in this file is what stops it drifting back:
// there's no shared table to add a translation to.
const DELETE_LABEL = "Delete recipe";
const LINES = [
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
];
const BLURB = "and everything in it — ingredients, steps, shelves.";
const KEEP_IT = "Keep it";
const CONFIRM = "Delete";
const DELETING = "Deleting…";

// Picked on open rather than on render: the component is server-rendered as
// part of the card list, and choosing a random line during render would make
// the server and client markup disagree (hydration mismatch). By the time
// the dialog opens we're client-only, so a fresh line every time is free.
function randomLine(): string {
  return LINES[Math.floor(Math.random() * LINES.length)];
}

export function DeleteRecipe({
  recipeId,
  title,
  variant,
}: {
  recipeId: string;
  title: string;
  /** `"icon"` is the low-hierarchy × that sits on a home-page card;
   *  `"full"` is the labelled button on the recipe detail page. */
  variant: "icon" | "full";
}) {
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
            setLine(randomLine());
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
          onClick={() => setLine(randomLine())}
          className="w-full rounded-full border border-border px-4 py-3 font-heading text-[15px] font-semibold text-muted transition active:scale-[0.98] hover:border-warn-text/40 hover:text-warn-text"
        >
          {DELETE_LABEL}
        </button>
      )}

      {/* Portalled to <body>, which is not cosmetic — it's the only thing that
          makes `fixed inset-0` mean the viewport here.

          The icon variant of this button lives on a home-page card, and those
          cards sit inside the `.card-enter`/`.card-drop` wrappers that carry
          the deal-and-drop scroll animation. An element with a transform (or
          an animation that *might* produce one — the property being animated
          is enough, running or filling) becomes the containing block for any
          `position: fixed` descendant. So the dialog was being laid out
          against a 240px-wide card instead of the screen: the backdrop covered
          the card, the sheet overflowed the top of it, and `flex-1` on two
          buttons in a 240px box left them narrow enough that `rounded-full`
          made them circles rather than pills.

          Rendering into <body> puts it back outside every transformed
          ancestor. `open` is only ever true after a click, so this never runs
          during the server render and `document` is always there. */}
      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={DELETE_LABEL}
            className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/35 px-5 py-8 backdrop-blur-[2px]"
            onClick={() => setLine(null)}
          >
            <div
              // Stops a click inside the sheet from reaching the backdrop's
              // dismiss handler.
              onClick={(e) => e.stopPropagation()}
              // Positioned with auto margins rather than `items-end
              // sm:items-center`, which do the same job but fail the same way
              // the containing-block bug did: an `align-items` value pins the
              // sheet to one edge, and if it's ever taller than the viewport
              // the other edge overflows *above* the scroll origin, where it
              // can't be scrolled to. Auto margins collapse to zero when
              // there's no free space, so the sheet just starts at the top and
              // the `overflow-y-auto` above reaches the rest.
              className="mt-auto w-full max-w-sm rounded-[28px] bg-card p-5 shadow-[0px_24px_60px_rgba(0,0,0,0.25)] sm:my-auto"
            >
              <h2 className="text-lg leading-snug">{line}</h2>
              {/* The title is recipe content, so it keeps its own direction
                  even inside a dialog that has already taken the recipe's. The
                  conjunction lives in the blurb string rather than in the JSX:
                  Hebrew attaches it to the following word (״וכל מה שבתוכו״) and
                  has no separate token to sit here. */}
              <p className="mt-2 text-sm text-muted">
                <span dir={dirFor(title)} className="font-semibold text-foreground">
                  {title}
                </span>{" "}
                {BLURB}
              </p>

              {state.message && (
                <p
                  role="alert"
                  className="mt-3 rounded-2xl bg-warn-bg px-4 py-2.5 text-sm font-semibold text-warn-text"
                >
                  {state.message}
                </p>
              )}

              {/* Both halves are a `min-w-0 flex-1` wrapper around a `w-full`
                  button, and the symmetry is load-bearing rather than tidiness.
                  Putting `flex-1` on the bare <button> and on the <form> looks
                  equivalent but isn't: `flex-basis: 0` is a *border-box* length
                  here, so it can't resolve below the element's own padding. The
                  padded button's hypothetical size was 32px (its px-4) while the
                  form's was 0, and the free space split on top of that — leaving
                  the pair 160/128 instead of even. `min-w-0` is separate, and
                  stops a long Hebrew label from setting a floor of its own. */}
              <div className="mt-5 flex gap-2">
                <div className="min-w-0 flex-1">
                  <button
                    ref={cancelRef}
                    type="button"
                    onClick={() => setLine(null)}
                    className="w-full rounded-full bg-button-inactive-bg px-4 py-2.5 font-heading text-[15px] font-semibold text-foreground transition active:scale-[0.98]"
                  >
                    {KEEP_IT}
                  </button>
                </div>
                <form action={formAction} className="min-w-0 flex-1">
                  <input type="hidden" name="recipe_id" value={recipeId} />
                  <ConfirmButton />
                </form>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      // The app's pink, not a warning colour. Consistent with the rest of the
      // UI, and consistent with the tone of the copy above it — the dialog is
      // deliberately light about this (see the note at the top of the file),
      // so a brown-red "danger" button was arguing with its own wording.
      className="w-full rounded-full bg-accent px-4 py-2.5 font-heading text-[15px] font-semibold text-accent-ink shadow-[0px_10px_24px_rgba(244,166,210,0.5)] transition active:scale-[0.98] disabled:opacity-60"
    >
      {pending ? DELETING : CONFIRM}
    </button>
  );
}
