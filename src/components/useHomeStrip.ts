"use client";

import { useCallback, useEffect, useRef } from "react";

// Remembers how far along the home page's horizontal card strip you were, so
// coming back from a recipe doesn't dump you at the first card again.
//
// That is now the *only* thing this hook does, and the empty space is the
// point. It also used to intercept flicks and throw the strip further than the
// one card a `scroll-snap-type: x mandatory` container allows — first with
// `scrollTo({ behavior: "smooth" })`, then with a hand-eased, interruptible
// glide. Both were asked for and both were wrong in the hand: the native
// version couldn't be caught mid-flight, and the hand-rolled one had to switch
// snapping off while it ran, which meant the strip was briefly obeying
// different physics than the ones you'd just been feeling.
//
// The browser's own snap is better than either, because it isn't an animation
// at all — it's the momentum of the actual gesture, clamped. It tracks the
// finger, it stops when you stop it, and one card per flick turns out to be
// fine for a recipe box that holds a few dozen recipes rather than a feed.
//
// So: no touch listeners, no velocity sampling, no scroll-snap-type toggling.
// If reach ever genuinely needs extending, the thing to reach for is a wider
// viewport or smaller cards, not a script fighting the compositor.

/** Where the strip's offset is stashed between navigations.
 *
 *  `sessionStorage`, not `localStorage`: this is "where was I a moment ago",
 *  which should not survive closing the app. Opening the box fresh tomorrow
 *  should start at the beginning. */
const STORAGE_KEY = "subarashii:home-strip-scroll";

function readSaved(): number {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    // Private-mode Safari throws on sessionStorage access rather than
    // returning null. Losing the position is not worth a crash.
    return 0;
  }
}

/**
 * @param remember  whether the current view is worth restoring to. False while
 *                  a search or category filter is active: those are client
 *                  state that doesn't survive the navigation, so the strip
 *                  comes back holding a different set of cards and a saved
 *                  offset would point at the wrong one.
 */
export function useHomeStrip(remember: boolean) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const restored = useRef(false);
  // `remember` is read inside a long-lived listener; a ref keeps it from
  // needing to be torn down and rebuilt every time a filter toggles. Synced in
  // an effect rather than assigned in the render body, which the repo's
  // `react-hooks` rules reject outright — a render can be thrown away or
  // replayed, and a ref written during one is a mutation that survives it.
  const rememberRef = useRef(remember);
  useEffect(() => {
    rememberRef.current = remember;
  }, [remember]);

  // Restoration happens in a *callback ref* rather than an effect, and the
  // distinction is visible: a callback ref runs during the commit, before the
  // browser paints, so the strip is never painted at zero and then jumped.
  // `useLayoutEffect` would also run before paint but warns when the component
  // is server-rendered, which this one is.
  const ref = useCallback((node: HTMLDivElement | null) => {
    nodeRef.current = node;
    if (!node || restored.current) return;
    restored.current = true;
    const saved = readSaved();
    if (saved > 0) node.scrollLeft = saved;
  }, []);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    // Written on scroll rather than on card-tap, because there are several
    // ways to leave this page (a card, the nav, the back gesture) and only one
    // way to move the strip. Coalesced to one write per frame: a fling fires
    // scroll events at display rate, and sessionStorage is synchronous.
    let pending = false;
    const onScroll = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        if (!rememberRef.current) return;
        try {
          sessionStorage.setItem(STORAGE_KEY, String(node.scrollLeft));
        } catch {
          // See readSaved.
        }
      });
    };

    node.addEventListener("scroll", onScroll, { passive: true });
    return () => node.removeEventListener("scroll", onScroll);
  }, []);

  return ref;
}
