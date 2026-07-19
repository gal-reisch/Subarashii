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
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link
          href={`/recipe/${recipeId}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-lg active:scale-95"
          aria-label="Exit Cook Mode"
        >
          ✕
        </Link>
        <div className="min-w-0 flex-1">
          <p dir={dirFor(title)} className="truncate text-sm font-semibold">
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

      <div className="flex gap-1 border-b border-border px-4 pt-2">
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
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <span className="text-sm font-semibold text-muted">
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
                    className="mt-6 rounded-full bg-accent px-5 py-3 font-semibold text-accent-ink active:scale-95"
                  >
                    ⏱ Start {formatClock(current.detected_timer_seconds)} timer
                  </button>
                )}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                  disabled={stepIndex === 0}
                  className="flex-1 rounded-full border border-border py-4 text-lg font-semibold disabled:opacity-30 active:scale-95"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStepIndex((i) => Math.min(steps.length - 1, i + 1))}
                  disabled={stepIndex === steps.length - 1}
                  className="flex-1 rounded-full bg-accent py-4 text-lg font-semibold text-accent-ink disabled:opacity-30 active:scale-95"
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
                  <button
                    onClick={() => toggleIngredient(ing.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition ${
                      checked
                        ? "border-border bg-border/40 text-muted line-through"
                        : "border-border bg-card"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs ${
                        checked ? "border-accent bg-accent text-accent-ink" : "border-border"
                      }`}
                    >
                      {checked ? "✓" : ""}
                    </span>
                    <span dir={dirFor(ing.raw_text)} className="text-[15px]">
                      {ing.raw_text}
                    </span>
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
      className={`rounded-t-lg px-4 py-2 text-sm font-semibold ${
        active ? "border-b-2 border-accent text-foreground" : "text-muted"
      }`}
    >
      {children}
    </button>
  );
}
