"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { retryImportAction, type RetryImportState } from "@/app/actions";

// The "we couldn't read this one" escape hatch on the recipe detail page.
//
// A stub recipe is almost always a transient failure — Instagram served a
// login wall, or a blog timed out — and the same link read again works. This
// is a client component only so the button can say "Reading…" while the
// re-parse runs; it can take several seconds (network fetch plus an LLM call)
// and a dead button in that window reads as a broken app.
export function RetryImport({ recipeId }: { recipeId: string }) {
  const [state, formAction] = useActionState<RetryImportState, FormData>(
    retryImportAction,
    { message: null, ok: false },
  );

  // On success the page revalidates and the surrounding banner disappears with
  // it, so there's nothing to render for the happy path.
  return (
    <form action={formAction} className="mt-3">
      <input type="hidden" name="recipe_id" value={recipeId} />
      <RetryButton />
      {state.message && (
        <p role="alert" className="mt-2 text-[13px] text-warn-text/80">
          {state.message}
        </p>
      )}
    </form>
  );
}

function RetryButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-warn-text/10 px-4 py-2 font-heading text-[13px] font-semibold text-warn-text transition active:scale-[0.98] disabled:opacity-60"
    >
      {pending ? "Reading the link…" : "Try reading it again"}
    </button>
  );
}
