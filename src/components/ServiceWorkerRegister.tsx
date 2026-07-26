"use client";

import { useEffect } from "react";

// Registers the offline cache (public/sw.js) — but only in production
// builds.
//
// In development the service worker caches navigation responses by URL, so a
// reload gets served the previously-cached HTML shell. That shell embeds the
// build id it was generated with; Next's dev client compares it against the
// running server's, finds a mismatch, and hard-reloads to recover. The reload
// hits the same cached shell again, so it never recovers — the page just
// reloads forever, hydration never finishes and no click handler ever
// attaches. (Symptom when this bites: a page that looks fine but where
// nothing is interactive, and a console full of repeated startup logs.)
//
// Any worker registered by an earlier dev session outlives this change —
// it's installed in the browser, not the bundle — so also actively
// unregister it and drop its caches rather than just declining to register a
// new one.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .then(() => caches?.keys())
        .then((keys) => Promise.all((keys ?? []).map((k) => caches.delete(k))))
        .catch(() => {
          // Best-effort cleanup; nothing here is worth breaking the page for.
        });
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failures are non-fatal (e.g. unsupported browser).
    });
  }, []);

  return null;
}
