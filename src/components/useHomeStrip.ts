"use client";

import { useCallback, useEffect, useRef } from "react";

// Two behaviours for the home page's horizontal card strip, together in one
// hook because they both need the same element ref and the same measurement of
// how far one card is:
//
//   1. Remembering where you were, so coming back from a recipe doesn't dump
//      you at the first card again.
//   2. Making a flick travel further than the one card a mandatory snap
//      container normally allows.

/** Where the strip's offset is stashed between navigations.
 *
 *  `sessionStorage`, not `localStorage`: this is "where was I a moment ago",
 *  which should not survive closing the app. Opening the box fresh tomorrow
 *  should start at the beginning. */
const STORAGE_KEY = "subarashii:home-strip-scroll";

/** Minimum finger speed, in px/ms, that counts as a flick rather than a drag.
 *  Below this the native mandatory snap handles it, which is what gives the
 *  precise one-card-at-a-time control for hunting down a specific card. */
const FLICK_MIN_SPEED = 0.35;

/** The speed at which the boost is considered maxed out. Anything faster
 *  gets the same (largest) throw, so a violent swipe doesn't fire the strip
 *  to the far end. */
const FLICK_MAX_SPEED = 0.95;

/** The ask, literally: a flick that used to travel one card should travel
 *  1.7. Because the strip snaps, the actual landing is rounded to a whole
 *  card — so a normal flick now advances two cards instead of one, and
 *  faster flicks scale up from there. */
const REACH = 1.7;

/** Hardest flick advances this many times the base reach. */
const MAX_STRENGTH = 2.6;

/** Only samples from the last moment of the gesture decide the velocity —
 *  what matters is how fast the finger was moving when it left, not the
 *  average over a long slow drag that ended with a twitch. */
const VELOCITY_WINDOW_MS = 120;

interface Sample {
  x: number;
  t: number;
}

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
  // `remember` is read inside long-lived listeners; a ref keeps them from
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

    // ---- 1. Remember the offset -------------------------------------------
    //
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

    // ---- 2. Make a flick reach further ------------------------------------
    //
    // A `scroll-snap-type: x mandatory` container deliberately clamps momentum
    // to the adjacent snap point — one card per flick, however hard you throw
    // it. That's the right default for a short row and the wrong one for a box
    // with a lot of recipes in it, where getting to the far end means the same
    // flick a dozen times.
    //
    // Touch events, not pointer events. Once the browser decides a horizontal
    // drag belongs to this scroller it takes over the gesture and fires
    // `pointercancel`, so pointermove stops arriving exactly when the
    // interesting part of the movement happens. Touch events keep firing
    // through a native scroll.
    let samples: Sample[] = [];

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      samples = [{ x: t.clientX, t: e.timeStamp }];
    };

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      samples.push({ x: t.clientX, t: e.timeStamp });
      const cutoff = e.timeStamp - VELOCITY_WINDOW_MS;
      // Keep one sample older than the window so there's always a pair to
      // measure across, even for a very short flick.
      while (samples.length > 2 && samples[1].t < cutoff) samples.shift();
    };

    const onTouchEnd = () => {
      const boost = flickTarget(node, samples);
      samples = [];
      if (boost === null) return;
      // Next frame, so this lands after the browser has committed the end of
      // the gesture — issued synchronously in the touchend handler it can be
      // overwritten by the native momentum-and-snap that starts immediately
      // after.
      requestAnimationFrame(() => {
        node.scrollTo({
          left: boost,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
        });
      });
    };

    node.addEventListener("touchstart", onTouchStart, { passive: true });
    node.addEventListener("touchmove", onTouchMove, { passive: true });
    node.addEventListener("touchend", onTouchEnd, { passive: true });
    node.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      node.removeEventListener("scroll", onScroll);
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchmove", onTouchMove);
      node.removeEventListener("touchend", onTouchEnd);
      node.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  return ref;
}

/** One card's worth of scrolling, measured from the DOM rather than hardcoded
 *  — the cards overlap, so the pitch is the card width minus the overlap and
 *  both of those live in Tailwind classes that can change without this file
 *  hearing about it. */
function cardPitch(node: HTMLElement): number {
  const first = node.children[0] as HTMLElement | undefined;
  const second = node.children[1] as HTMLElement | undefined;
  if (!first) return 0;
  if (!second) return first.offsetWidth;
  return Math.abs(second.offsetLeft - first.offsetLeft);
}

/**
 * The scroll offset a flick should be redirected to, or `null` if the gesture
 * wasn't a flick and the browser's own snapping should be left alone.
 *
 * Exported for the sake of being testable in isolation; the geometry here is
 * the part most likely to need tuning.
 */
export function flickTarget(node: HTMLElement, samples: Sample[]): number | null {
  if (samples.length < 2) return null;

  const first = samples[0];
  const last = samples[samples.length - 1];
  const dt = last.t - first.t;
  if (dt <= 0) return null;

  const dx = last.x - first.x;
  const speed = Math.abs(dx) / dt;
  if (speed < FLICK_MIN_SPEED) return null;

  const pitch = cardPitch(node);
  if (pitch <= 0) return null;

  // Finger moving left (negative dx) pulls the content leftward, which means
  // scrolling further *into* the strip.
  const direction = dx < 0 ? 1 : -1;

  // A linear ramp from 1 at the flick threshold to MAX_STRENGTH at a hard
  // throw, clamped at both ends.
  const ramp =
    (speed - FLICK_MIN_SPEED) / (FLICK_MAX_SPEED - FLICK_MIN_SPEED);
  const strength = Math.min(
    MAX_STRENGTH,
    Math.max(1, 1 + ramp * (MAX_STRENGTH - 1)),
  );
  // At least two cards: one is what the native snap already does, so a boost
  // that rounds down to one wouldn't be a boost at all.
  const cards = Math.max(2, Math.round(REACH * strength));

  const currentIndex = Math.round(node.scrollLeft / pitch);
  const target = (currentIndex + direction * cards) * pitch;
  const max = node.scrollWidth - node.clientWidth;
  return Math.min(Math.max(target, 0), max);
}
