"use client";

import { useEffect, useState } from "react";
import { onToast, type ToastDetail } from "@/lib/toast";

// The single listener for `showToast()`. Mounted once in the root layout.
//
// "Low hierarchy" was the explicit ask, and everything here is in service of
// that: it sits above the bottom nav rather than over the content, it's a
// small translucent pill rather than a card, it never takes focus, it can't
// be dismissed (because there's nothing to decide), and it leaves on its own.
// `aria-live="polite"` is the accessible equivalent of the same idea — a
// screen reader mentions it when it next pauses, rather than interrupting.

interface Toast extends ToastDetail {
  id: number;
}

/** Long enough to read a short sentence, short enough that it's gone before
 *  it's in the way. */
const LIFETIME_MS = 2600;

let nextId = 0;

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    return onToast((detail) => {
      const id = nextId++;
      // Only ever one on screen. Two stacked toasts would be a queue to read,
      // which is more attention than this deserves — filing a recipe onto
      // three shelves quickly should replace the line, not build a tower.
      setToasts([{ ...detail, id }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, LIFETIME_MS);
    });
  }, []);

  return (
    // `pointer-events-none` on the container and never on a child: the toast
    // overlaps the bottom nav's safe area, and it must not eat a tap meant for
    // the nav underneath it.
    //
    // `bottom-28` clears the nav pill. z-[60] puts it above everything
    // including dialogs (z-50) — which it has to be, because the shelf sheet
    // deliberately stays open while you tick shelves, and that's exactly when
    // it raises a toast. A toast rendered *under* its own trigger's dialog
    // would never be seen.
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex flex-col items-center px-5"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          // Same glass as the bottom nav, at a smaller radius and weight, so
          // it reads as part of the same furniture rather than a notification
          // from somewhere else.
          className="toast-in flex max-w-full items-center gap-2 rounded-full border border-white/60 bg-white/75 px-4 py-2.5 text-sm font-semibold text-foreground shadow-[0px_8px_24px_rgba(0,0,0,0.12)] backdrop-blur-xl"
        >
          {t.icon && (
            <span aria-hidden className="text-base leading-none">
              {t.icon}
            </span>
          )}
          <span className="truncate">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
