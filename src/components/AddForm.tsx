"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { addFromUrlAction, addManualAction } from "@/app/actions";
import { buttonClass } from "@/components/Button";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary")}>
      {pending ? "Saving…" : label}
    </button>
  );
}

const labelClass = "font-heading text-[17px] font-semibold text-foreground";

// White bg + pink 1px border + soft shadow, per the Figma "Add a Recipe"
// frame — the pink border is a base-state style there, not focus-only, so
// focus just tightens it into a 2px ring rather than introducing the color.
const inputClass =
  "rounded-[10px] border border-accent bg-white px-4 py-3.5 outline-none shadow-[0px_10px_40px_0px_rgba(0,0,0,0.03)] focus:shadow-[0px_0px_0px_2px_var(--accent)]";

export function AddForm() {
  const [tab, setTab] = useState<"link" | "manual">("link");

  return (
    <div>
      <div className="mb-6 flex gap-2 rounded-full bg-card p-1 text-sm font-semibold shadow-[0px_6px_20px_rgba(0,0,0,0.05)]">
        <button
          onClick={() => setTab("link")}
          className={`flex-1 rounded-full px-4 py-2 font-heading font-medium transition ${
            tab === "link" ? "bg-accent text-accent-ink" : "text-button-inactive-text"
          }`}
        >
          via Link
        </button>
        <button
          onClick={() => setTab("manual")}
          className={`flex-1 rounded-full px-4 py-2 font-heading font-medium transition ${
            tab === "manual" ? "bg-accent text-accent-ink" : "text-button-inactive-text"
          }`}
        >
          Manual
        </button>
      </div>

      {tab === "link" ? (
        <form action={addFromUrlAction} className="flex flex-col gap-3">
          <label className={labelClass}>Recipe link</label>
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
          <label className={labelClass}>Title</label>
          <input name="title" type="text" required className={inputClass} />

          <label className={`mt-2 ${labelClass}`}>
            Ingredients{" "}
            <span className="font-normal text-muted">(one per line)</span>
          </label>
          <textarea name="ingredients" rows={6} className={inputClass} />

          <label className={`mt-2 ${labelClass}`}>
            Steps <span className="font-normal text-muted">(one per line)</span>
          </label>
          <textarea name="steps" rows={6} className={inputClass} />

          <label className={`mt-2 ${labelClass}`}>Servings</label>
          <input
            name="servings"
            type="number"
            min={1}
            className={inputClass}
          />

          <label className={`mt-2 ${labelClass}`}>
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
