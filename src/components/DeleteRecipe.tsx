"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteRecipeAction } from "@/app/actions";

// Confirm copy, in the same deadpan register as the home-page headlines
// (see lib/quotes.ts). Deliberately low-key: this is a personal recipe box,
// not a bank transfer, and a stern red "THIS CANNOT BE UNDONE" modal would
// be doing more emotional work than the situation calls for. Still says the
// word "gone" somewhere, though — the joke shouldn't cost you the recipe.
const CONFIRM_LINES: string[] = [
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

// Picked on open rather than on render: the component is server-rendered as
// part of the card list, and choosing a random line during render would make
// the server and client markup disagree (hydration mismatch). By the time
// the dialog opens we're client-only, so a fresh line every time is free.
function randomLine(): string {
  return CONFIRM_LINES[Math.floor(Math.random() * CONFIRM_LINES.length)];
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
    // never be one stray Enter away.
    cancelRef.current?.focus();
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
          Delete recipe
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm delete"
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
            {/* The title is recipe content, so it gets its own direction —
                the dialog's own chrome stays LTR like the rest of the app. */}
            <p className="mt-2 text-sm text-muted">
              <span className="font-semibold text-foreground">{title}</span> and
              everything in it — ingredients, steps, shelves.
            </p>

            <div className="mt-6 flex gap-2">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => setLine(null)}
                className="flex-1 rounded-full bg-button-inactive-bg px-4 py-3 font-heading font-semibold text-foreground transition active:scale-[0.98]"
              >
                Keep it
              </button>
              <form action={deleteRecipeAction} className="flex-1">
                <input type="hidden" name="recipe_id" value={recipeId} />
                <ConfirmButton />
              </form>
            </div>
          </div>
        </div>
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
      className="w-full rounded-full bg-warn-text px-4 py-3 font-heading font-semibold text-white transition active:scale-[0.98] disabled:opacity-60"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
