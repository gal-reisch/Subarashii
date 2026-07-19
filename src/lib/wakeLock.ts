"use client";

import { useEffect, useRef } from "react";

// Minimal ambient shape — the Wake Lock API isn't in every TS DOM lib yet.
interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
}

// Keeps the screen awake while `active` is true (Cook Mode). Re-acquires the
// lock automatically when the tab/PWA comes back to the foreground, since the
// OS releases it whenever the page is hidden (e.g. phone auto-locks).
export function useWakeLock(active: boolean) {
  const lockRef = useRef<WakeLockSentinelLike | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function acquire() {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
      };
      if (!nav.wakeLock) return;
      try {
        const lock = await nav.wakeLock.request("screen");
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        lockRef.current = lock;
      } catch {
        // Unsupported, or blocked (e.g. Low Power Mode) — fail silently.
        // Cook Mode still works; she just needs to tap the screen occasionally.
      }
    }

    acquire();

    function onVisibility() {
      if (document.visibilityState === "visible") acquire();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [active]);
}
