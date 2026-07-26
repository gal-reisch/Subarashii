"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createCollectionAction,
  toggleRecipeInCollectionAction,
} from "@/app/collections/actions";

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
  const closeRef = useRef<HTMLButtonElement>(null);
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
    closeRef.current?.focus();
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

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Shelves"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-5 pb-8 backdrop-blur-[2px] sm:items-center sm:pb-0"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-[28px] bg-card p-6 shadow-[0px_24px_60px_rgba(0,0,0,0.25)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl leading-snug">Put it on a shelf</h2>
                <p className="mt-1 text-sm text-muted">
                  Tap to add or remove. A recipe can sit on as many as you like.
                </p>
              </div>
              <button
                ref={closeRef}
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
                        <input type="hidden" name="recipe_id" value={recipeId} />
                        <input type="hidden" name="collection_id" value={shelf.id} />
                        <input type="hidden" name="is_member" value={String(isMember)} />
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
              <button
                type="submit"
                className="shrink-0 rounded-full bg-accent px-4 py-2.5 font-heading text-sm font-semibold text-accent-ink transition active:scale-95"
              >
                Create
              </button>
            </form>
          </div>
        </div>
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
