"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal, useFormStatus } from "react-dom";
import {
  createCollectionAction,
  toggleRecipeInCollectionAction,
} from "@/app/collections/actions";
import { shelvedLine, showToast } from "@/lib/toast";

// "Put this on a shelf", as an icon in the recipe's top bar next to the
// favorite heart.
//
// This replaces a full-width "Shelves" section that sat directly under Start
// Cooking — a whole labelled block, with every shelf rendered as a chip,
// competing with the ingredients for attention on a screen whose job is to
// show you a recipe. Filing is something you do once, right after saving;
// reading the recipe is what you do every other time. So it moves up next to
// the heart, which is the other one-tap "where does this belong" control, and
// the list only appears when asked for.
//
// Each row is still its own plain <form> posting to the same Server Action the
// old chips used, so the actual filing works without client JS. The client
// component exists for the sheet: opening, Escape, scroll lock.

export interface Shelf {
  id: string;
  name: string;
}

export function ShelfPicker({
  recipeId,
  shelves,
  memberIds,
}: {
  recipeId: string;
  shelves: Shelf[];
  /** Ids of the shelves this recipe is already on. */
  memberIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const members = new Set(memberIds);
  const count = memberIds.length;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // The sheet, not the × inside it — focusing a button paints the browser's
    // focus ring on it, which looks like a bug to anyone who opened this with
    // a thumb. See the longer note in DeleteRecipe.tsx. `preventScroll` so
    // focusing it can't shift the page behind the sheet.
    sheetRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Toggling a shelf revalidates the page, which re-renders this component
  // with fresh `memberIds` — but the sheet stays open on purpose, so filing a
  // recipe onto three shelves is three taps rather than three open/close
  // cycles. The checkmarks update underneath.
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={
          count === 0
            ? "Put on a shelf"
            : `On ${count} shelf${count === 1 ? "" : "s"} — change`
        }
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-accent transition active:scale-90"
      >
        <ShelfIcon />
        {count > 0 && (
          // A filled dot rather than a number: the exact count isn't worth
          // reading at this size, and "it's filed somewhere" is the whole
          // signal anyone needs at a glance.
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-background"
          />
        )}
      </button>

      {/* Portalled to <body>, and not for tidiness — it's the only thing that
          makes `fixed inset-0` mean the viewport here. This button lives in
          RecipeTopBar, whose outer box carries `transform: translateZ(0)` to
          keep the hide-on-scroll animation on the compositor. A transform makes
          an element the containing block for every `position: fixed`
          descendant, so the sheet was being laid out against the top bar
          instead of the screen: it sat up under the bar (the "too high" bug)
          rather than centred on the page. Same root cause as the home-card
          delete dialog — see the longer note in DeleteRecipe.tsx.

          `open` is only ever true after a click, so this never runs during the
          server render and `document` is always there. */}
      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Shelves"
            // Same backdrop and positioning as the delete dialog, deliberately:
            // two sheets that do the same kind of job should arrive the same
            // way. Auto margins rather than `items-end sm:items-center`, so a
            // sheet taller than the viewport starts at the top and scrolls
            // instead of overflowing above the scroll origin where it can't be
            // reached — the shelf list can get long.
            className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/35 px-5 py-8 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          >
            <div
              ref={sheetRef}
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
              className="mt-auto w-full max-w-sm rounded-[28px] bg-card p-5 shadow-[0px_24px_60px_rgba(0,0,0,0.25)] outline-none sm:my-auto"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg leading-snug">Put it on a shelf</h2>
                  <p className="mt-1 text-sm text-muted">
                    Tap to add or remove. A recipe can sit on as many as you
                    like.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition active:scale-90"
                >
                  ✕
                </button>
              </div>

              {shelves.length > 0 && (
                <ul className="mt-5 max-h-64 space-y-2 overflow-y-auto">
                  {shelves.map((shelf) => {
                    const isMember = members.has(shelf.id);
                    return (
                      <li key={shelf.id}>
                        <form action={toggleRecipeInCollectionAction}>
                          <input
                            type="hidden"
                            name="recipe_id"
                            value={recipeId}
                          />
                          <input
                            type="hidden"
                            name="collection_id"
                            value={shelf.id}
                          />
                          <input
                            type="hidden"
                            name="is_member"
                            value={String(isMember)}
                          />
                          <ShelfRow name={shelf.name} isMember={isMember} />
                        </form>
                      </li>
                    );
                  })}
                </ul>
              )}

              <form action={createCollectionAction} className="mt-4 flex gap-2">
                <input type="hidden" name="recipe_id" value={recipeId} />
                <input
                  name="name"
                  placeholder="New shelf…"
                  aria-label="New shelf name"
                  className="min-w-0 flex-1 rounded-full bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-accent"
                />
                {/* Creating a shelf from here also files the recipe onto it
                    (see createCollectionAction), so it earns the same line as
                    ticking an existing shelf. */}
                <button
                  type="submit"
                  onClick={() => showToast(shelvedLine(), "🗂️")}
                  className="shrink-0 rounded-full bg-accent px-4 py-2.5 font-heading text-sm font-semibold text-accent-ink transition active:scale-95"
                >
                  Create
                </button>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function ShelfRow({ name, isMember }: { name: string; isMember: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      // Only on the way *in*. Taking a recipe off a shelf isn't organizing,
      // and being congratulated for it would be the app not paying attention.
      // Fresh copy each time — see `shelvedLine` in lib/toast.ts for why it
      // rotates rather than repeating one good line into the ground.
      onClick={() => {
        if (!isMember) showToast(shelvedLine(), "🗂️");
      }}
      aria-pressed={isMember}
      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[15px] transition active:scale-[0.98] disabled:opacity-60 ${
        isMember ? "bg-accent/20 font-semibold" : "bg-background"
      }`}
    >
      <span
        aria-hidden
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] ${
          isMember ? "bg-accent text-accent-ink" : "border-2 border-border"
        }`}
      >
        {isMember ? "✓" : ""}
      </span>
      <span className="min-w-0 flex-1 truncate">{name}</span>
    </button>
  );
}

// Three stacked bars, matching the Shelves glyph in the bottom nav so the same
// idea reads the same way in both places.
function ShelfIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="6" width="16" height="3" rx="1.5" fill="currentColor" />
      <rect x="4" y="10.5" width="16" height="3" rx="1.5" fill="currentColor" />
      <rect x="4" y="15" width="16" height="3" rx="1.5" fill="currentColor" />
    </svg>
  );
}
