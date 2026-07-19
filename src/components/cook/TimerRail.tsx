"use client";

import { useState } from "react";
import type { TimerPreset } from "@/lib/types";
import { formatClock, type RunningTimer } from "./useTimers";

interface TimerRailProps {
  presets: TimerPreset[];
  timers: (RunningTimer & { remaining: number })[];
  onStart: (label: string, seconds: number) => void;
  onStop: (id: string) => void;
  onAddMinute: (id: string) => void;
}

// Always-visible rail of large, tappable timer cards, plus one-tap preset
// chips and a custom-minutes sheet. Built for messy hands: big targets, no
// tiny keyboards, easy to tell timers apart at a glance.
export function TimerRail({ presets, timers, onStart, onStop, onAddMinute }: TimerRailProps) {
  const [customOpen, setCustomOpen] = useState(false);

  return (
    <div className="border-t border-border bg-card/60 px-4 py-3">
      {timers.length > 0 && (
        <div className="mb-3 flex gap-3 overflow-x-auto pb-1">
          {timers.map((t) => (
            <div
              key={t.id}
              className={`flex min-w-[9.5rem] shrink-0 flex-col rounded-2xl border px-4 py-3 transition ${
                t.remaining === 0
                  ? "animate-pulse border-accent bg-accent/15"
                  : "border-border bg-background"
              }`}
            >
              <span className="truncate text-xs font-semibold uppercase tracking-wide text-muted">
                {t.label}
              </span>
              <span className="mt-1 font-mono text-2xl font-bold tabular-nums">
                {t.remaining === 0 ? "Done!" : formatClock(t.remaining)}
              </span>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={() => onAddMinute(t.id)}
                  className="flex-1 rounded-full bg-border px-2 py-2 text-xs font-semibold active:scale-95"
                  aria-label={`Add one minute to ${t.label}`}
                >
                  +1 min
                </button>
                <button
                  onClick={() => onStop(t.id)}
                  className="flex-1 rounded-full bg-accent px-2 py-2 text-xs font-semibold text-accent-ink active:scale-95"
                  aria-label={`Stop ${t.label}`}
                >
                  Stop
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => onStart(p.label, p.default_seconds)}
            className="rounded-full border border-border bg-background px-4 py-2.5 text-sm font-semibold active:scale-95"
          >
            {p.label} · {formatClock(p.default_seconds)}
          </button>
        ))}
        <button
          onClick={() => setCustomOpen(true)}
          className="rounded-full border border-dashed border-accent px-4 py-2.5 text-sm font-semibold text-accent active:scale-95"
        >
          + Custom timer
        </button>
      </div>

      {customOpen && (
        <CustomTimerSheet
          onClose={() => setCustomOpen(false)}
          onStart={(label, seconds) => {
            onStart(label, seconds);
            setCustomOpen(false);
          }}
        />
      )}
    </div>
  );
}

function CustomTimerSheet({
  onClose,
  onStart,
}: {
  onClose: () => void;
  onStart: (label: string, seconds: number) => void;
}) {
  const [minutes, setMinutes] = useState(5);
  const [label, setLabel] = useState("Timer");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="w-full max-w-md rounded-t-3xl bg-card p-5 pb-8">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
        <p className="text-center text-sm font-semibold text-muted">New timer</p>

        <div className="mt-4 flex items-center justify-center gap-6">
          <button
            onClick={() => setMinutes((m) => Math.max(1, m - 1))}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-border text-2xl font-bold active:scale-95"
            aria-label="Fewer minutes"
          >
            –
          </button>
          <span className="w-24 text-center font-mono text-4xl font-bold tabular-nums">
            {minutes}m
          </span>
          <button
            onClick={() => setMinutes((m) => Math.min(180, m + 1))}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-border text-2xl font-bold active:scale-95"
            aria-label="More minutes"
          >
            +
          </button>
        </div>

        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Oven #2)"
          className="mt-5 w-full rounded-xl border border-border bg-background px-4 py-3 text-center text-base"
        />

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-border py-3 font-semibold active:scale-95"
          >
            Cancel
          </button>
          <button
            onClick={() => onStart(label.trim() || "Timer", minutes * 60)}
            className="flex-1 rounded-full bg-accent py-3 font-semibold text-accent-ink active:scale-95"
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
}
