"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { addFromUrlAction, addManualAction } from "@/app/actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-xl bg-accent px-4 py-3 font-semibold text-accent-ink transition active:scale-[0.98] disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

const inputClass =
  "rounded-xl border border-border bg-card px-4 py-3 outline-none focus:border-accent";

export function AddForm() {
  const [tab, setTab] = useState<"link" | "manual">("link");

  return (
    <div>
      <div className="mb-6 flex gap-2 rounded-full border border-border bg-card p-1 text-sm font-semibold">
        <button
          onClick={() => setTab("link")}
          className={`flex-1 rounded-full px-4 py-2 transition ${
            tab === "link" ? "bg-accent text-accent-ink" : "text-muted"
          }`}
        >
          Paste a link
        </button>
        <button
          onClick={() => setTab("manual")}
          className={`flex-1 rounded-full px-4 py-2 transition ${
            tab === "manual" ? "bg-accent text-accent-ink" : "text-muted"
          }`}
        >
          Type it in
        </button>
      </div>

      {tab === "link" ? (
        <form action={addFromUrlAction} className="flex flex-col gap-3">
          <label className="text-sm font-semibold">Recipe link</label>
          <input
            name="url"
            type="url"
            required
            autoFocus
            placeholder="https://…"
            className={inputClass}
          />
          <p className="text-xs text-muted">
            Works best with recipe blogs. Instagram/TikTok links are saved for
            you to finish by hand.
          </p>
          <SubmitButton label="Save recipe" />
        </form>
      ) : (
        <form action={addManualAction} className="flex flex-col gap-3">
          <label className="text-sm font-semibold">Title</label>
          <input name="title" type="text" required className={inputClass} />

          <label className="mt-2 text-sm font-semibold">
            Ingredients{" "}
            <span className="font-normal text-muted">(one per line)</span>
          </label>
          <textarea name="ingredients" rows={6} className={inputClass} />

          <label className="mt-2 text-sm font-semibold">
            Steps <span className="font-normal text-muted">(one per line)</span>
          </label>
          <textarea name="steps" rows={6} className={inputClass} />

          <label className="mt-2 text-sm font-semibold">Servings</label>
          <input
            name="servings"
            type="number"
            min={1}
            className={inputClass}
          />

          <label className="mt-2 text-sm font-semibold">
            Cover image URL{" "}
            <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            name="cover_image_url"
            type="url"
            placeholder="https://…"
            className={inputClass}
          />

          <SubmitButton label="Save recipe" />
        </form>
      )}
    </div>
  );
}
