"use client";

import { useSyncExternalStore } from "react";
import { dayKey, homeGreeting, type BoxContext } from "@/lib/homeGreeting";

// A headline that refers to the time of day has to read *her* clock, not the
// server's. The page is server-rendered and Vercel runs in UTC, so a line
// picked server-side was reliably three hours behind an Israeli evening — the
// bug this component exists to fix.
//
// useSyncExternalStore rather than the reflexive useState + useEffect:
//
//   - It has a first-class server snapshot, so the markup React hydrates
//     against is the server's and there's no mismatch warning.
//   - It re-renders without a setState inside an effect, which this repo
//     lints as an error (see the rule firing in cook/useTimers.ts).
//   - The subscribe half isn't a formality: the app is a PWA that sits open
//     on a kitchen counter for hours, so the greeting should notice when
//     afternoon becomes evening rather than being frozen at whatever it said
//     when the tab was opened.
//
// In the normal case — device and household in the same zone — the server and
// client snapshots are identical and nothing visibly changes.

/** Re-check on the minute. Cheap, and the only thing it can do is change one
 *  string when an hour boundary passes. */
function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

export function HomeGreeting({
  serverKey,
  box,
  seed,
}: {
  /** The server's `dayKey()` for the household zone. Used for the initial
   *  render and as the hydration snapshot. */
  serverKey: string;
  box: BoxContext;
  /** Fixed per page load so correcting the clock changes the time words
   *  without also reshuffling which line was picked. */
  seed: number;
}) {
  const key = useSyncExternalStore(
    subscribe,
    () => dayKey(new Date()),
    () => serverKey,
  );

  return <h1 className="text-3xl leading-tight text-balance">{homeGreeting(key, box, seed)}</h1>;
}
