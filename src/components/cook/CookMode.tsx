"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { dirFor } from "@/lib/lang";
import { useWakeLock } from "@/lib/wakeLock";
import type { TimerPreset } from "@/lib/types";
import { TimerRail } from "./TimerRail";
import { formatClock, useTimers } from "./useTimers";

interface CookStep {
  id: string;
  text: string;
  detected_timer_seconds: number | null;
}
interface CookIngredient {
  id: string;
  raw_text: string;
}

export function CookMode({
  recipeId,
  title,
  steps,
  ingredients,
  presets,
}: {
  recipeId: string;
  title: string;
  steps: CookStep[];
  ingredients: CookIngredient[];
  presets: TimerPreset[];
}) {
  useWakeLock(true);
  const { timers, start, stop, addMinute } = useTimers(`subarashii:cookTimers:${recipeId}`);

  const [tab, setTab] = useState<"steps" | "ingredients">("steps");
  const [stepIndex, setStepIndex] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<string>>(new Set());

  const current = steps[stepIndex];
  const progress = useMemo(
    () => (steps.length ? Math.round(((stepIndex + 1) / steps.length) * 100) : 0),
    [stepIndex, steps.length],
  );

  function toggleIngredient(id: string) {
    setCheckedIngredients((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex items-center gap-3 px-4 pb-2 pt-4">
        <Link
          href={`/recipe/${recipeId}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-lg shadow-[0px_6px_16px_rgba(0,0,0,0.08)] active:scale-95"
          aria-label="Exit Cook Mode"
        >
          ✕
        </Link>
        <div className="min-w-0 flex-1">
          <p dir={dirFor(title)} className="truncate text-sm font-bold">
            {title}
          </p>
          {steps.length > 0 && tab === "steps" && (
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </header>

      <div className="mx-4 mt-2 flex gap-1 rounded-full bg-card p-1 shadow-[0px_6px_20px_rgba(0,0,0,0.05)]">
        <TabButton active={tab === "steps"} onClick={() => setTab("steps")}>
          Steps
        </TabButton>
        <TabButton active={tab === "ingredients"} onClick={() => setTab("ingredients")}>
          Ingredients ({checkedIngredients.size}/{ingredients.length})
        </TabButton>
      </div>

      <main className="flex-1 overflow-y-auto px-5 py-6">
        {tab === "steps" ? (
          steps.length === 0 ? (
            <p className="text-center text-muted">This recipe has no steps yet.</p>
          ) : (
            <div className="flex h-full flex-col">
              <div className="flex flex-1 flex-col items-center justify-center rounded-[28px] bg-card px-6 py-8 text-center shadow-[0px_16px_40px_rgba(0,0,0,0.06)]">
                <span className="text-sm font-bold text-accent">
                  Step {stepIndex + 1} of {steps.length}
                </span>
                <p
                  dir={dirFor(current.text)}
                  className="mt-4 text-2xl font-medium leading-snug"
                >
                  {current.text}
                </p>
                {current.detected_timer_seconds && (
                  <button
                    onClick={() =>
                      start(`Step ${stepIndex + 1}`, current.detected_timer_seconds!)
                    }
                    className="mt-6 rounded-full bg-accent px-5 py-3 font-bold text-accent-ink shadow-[0px_10px_24px_rgba(244,166,210,0.5)] active:scale-95"
                  >
                    ⏱ Start {formatClock(current.detected_timer_seconds)} timer
                  </button>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                  disabled={stepIndex === 0}
                  className="flex-1 rounded-full bg-card py-4 text-lg font-bold shadow-[0px_6px_20px_rgba(0,0,0,0.06)] disabled:opacity-30 active:scale-95"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
                  disabled={stepIndex === steps.length - 1}
                  className="flex-1 rounded-full bg-accent py-4 text-lg font-bold text-accent-ink shadow-[0px_10px_24px_rgba(244,166,210,0.5)] disabled:opacity-30 active:scale-95"
                >
                  Next →
                </button>
              </div>
            </div>
          )
        ) : (
          <ul className="space-y-2">
            {ingredients.map((ing) => {
              const checked = checkedIngredients.has(ing.id);
              return (
                <li key={ing.id}>
                  {/* `dir` sits on the button (the flex container), not on the
                      text span, so the check circle mirrors to the right of a
                      Hebrew ingredient instead of staying pinned left with the
                      text jammed against it — same reasoning as the numbered
                      step badges on the recipe detail page. `text-start`
                      rather than `text-left` for the same reason: `text-left`
                      is a hardcoded physical direction that silently defeats
                      any inherited RTL. */}
                  <button
                    onClick={() => toggleIngredient(ing.id)}
                    dir={dirFor(ing.raw_text)}
                    className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-start shadow-[0px_4px_14px_rgba(0,0,0,0.05)] transition ${
                      checked ? "bg-border/40 text-muted line-through" : "bg-card"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs ${
                        checked ? "border-accent bg-accent text-accent-ink" : "border-border"
                      }`}
                    >
                      {checked ? "✓" : ""}
                    </span>
                    <span className="text-[15px]">{ing.raw_text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <TimerRail
        presets={presets}
        timers={timers}
        onStart={start}
        onStop={stop}
        onAddMinute={addMinute}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition ${
        active ? "bg-accent text-accent-ink" : "text-muted"
      }`}
    >
      {children}
    </button>
  );
}
