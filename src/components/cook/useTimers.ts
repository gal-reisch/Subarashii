"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playChime } from "@/lib/chime";
import { notifyTimerDone, requestNotifyPermission } from "@/lib/notify";

export interface RunningTimer {
  id: string;
  label: string;
  totalSeconds: number;
  endAt: number; // epoch ms
  alerted: boolean;
}

interface StoredTimer {
  id: string;
  label: string;
  totalSeconds: number;
  endAt: number;
}

// Several concurrent, clearly-labeled, hands-free timers — the feature Ella's
// cook mode is built around. Timers are timestamp-based (endAt), so they stay
// correct across screen locks/backgrounding, and persisted to localStorage so
// stepping away from Cook Mode (or a phone auto-lock) doesn't lose them.
export function useTimers(storageKey: string) {
  const [timers, setTimers] = useState<RunningTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const alertedRef = useRef<Set<string>>(new Set());

  // Load any timers already running from a previous visit to this recipe.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const stored: StoredTimer[] = JSON.parse(raw);
      const restored = stored
        .filter((t) => t.endAt > Date.now() - 60_000) // drop long-dead timers
        .map((t) => ({ ...t, alerted: t.endAt <= Date.now() }));
      setTimers(restored);
    } catch {
      // corrupt/empty — start fresh
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on every change.
  useEffect(() => {
    const stored: StoredTimer[] = timers.map(({ id, label, totalSeconds, endAt }) => ({
      id,
      label,
      totalSeconds,
      endAt,
    }));
    try {
      if (stored.length === 0) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify(stored));
    } catch {
      // storage unavailable (private mode) — timers still work in-memory
    }
  }, [timers, storageKey]);

  // Tick once a second so countdowns render and completions are caught.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fire the alert exactly once per timer, the moment it crosses zero.
  useEffect(() => {
    for (const t of timers) {
      if (t.endAt <= now && !alertedRef.current.has(t.id)) {
        alertedRef.current.add(t.id);
        playChime();
        if ("vibrate" in navigator) navigator.vibrate([200, 100, 200, 100, 200]);
        notifyTimerDone(t.label);
        setTimers((cur) => cur.map((x) => (x.id === t.id ? { ...x, alerted: true } : x)));
      }
    }
  }, [now, timers]);

  const start = useCallback((label: string, seconds: number) => {
    requestNotifyPermission();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setTimers((cur) => [
      ...cur,
      { id, label, totalSeconds: seconds, endAt: Date.now() + seconds * 1000, alerted: false },
    ]);
  }, []);

  const stop = useCallback((id: string) => {
    alertedRef.current.delete(id);
    setTimers((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const addMinute = useCallback((id: string) => {
    alertedRef.current.delete(id);
    setTimers((cur) =>
      cur.map((t) =>
        t.id === id
          ? {
              ...t,
              alerted: false,
              totalSeconds: t.totalSeconds + 60,
              endAt: Math.max(t.endAt, now) + 60_000,
            }
          : t,
      ),
    );
  }, [now]);

  const withRemaining = timers
    .map((t) => ({ ...t, remaining: Math.max(0, Math.round((t.endAt - now) / 1000)) }))
    .sort((a, b) => a.endAt - b.endAt);

  return { timers: withRemaining, start, stop, addMinute };
}

export function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
