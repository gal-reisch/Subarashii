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

/** How far a flick reaches, in cards, before the strength ramp is applied.
 *
 *  This started at 1.7 (task #59, "make each swipe travel ~1.7x further") and
 *  came back down. Combined with the ramp below, 1.7 put an ordinary flick two
 *  cards along and a firm one four, and four cards is past the point where you
 *  can still see where you came from — the strip stopped feeling like a shelf
 *  you were pushing and started feeling like a slot machine. 1.4 keeps the
 *  "further than one card" that was actually being asked for while landing in
 *  a range you can follow with your eyes. */
const REACH = 1.4;

/** Hardest flick advances this many times the base reach. With REACH above,
 *  the whole usable span is 2–3 cards. */
const MAX_STRENGTH = 2;

/** Only samples from the last moment of the gesture decide the velocity —
 *  what matters is how fast the finger was moving when it left, not the
 *  average over a long slow drag that ended with a twitch. */
const VELOCITY_WINDOW_MS = 120;

/** Glide timing. The duration scales with the distance so two cards and three
 *  cards move at roughly the same speed rather than taking the same time —
 *  a fixed duration is what makes a longer throw read as a teleport. */
const GLIDE_MIN_MS = 260;
const GLIDE_PER_PX = 0.42;
const GLIDE_MAX_MS = 560;

/** Decelerating, and only decelerating: the strip is already moving when the
 *  finger leaves, so easing *in* would mean stopping dead and starting again.
 *  Cubic rather than quadratic because the long tail is what makes catching it
 *  mid-glide feel like grabbing something that's coasting. */
function easeOutCubic(p: number): number {
  return 1 - Math.pow(1 - p, 3);
}

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

    // ---- The glide ---------------------------------------------------------
    //
    // Hand-animated rather than `scrollTo({ behavior: "smooth" })`, for the two
    // things the native version can't do:
    //
    //   * It can't be stopped. A smooth scroll runs to its destination and
    //     ignores everything until it gets there, so putting a finger down
    //     mid-flight did nothing — the strip kept going, and the next flick
    //     queued up behind it. Catching a moving thing is the most basic
    //     expectation of a surface you throw with your hand, and it was the
    //     specific complaint.
    //   * Its curve and duration aren't ours. It's tuned for jumping to an
    //     anchor, so it accelerates from a standstill — but the strip is
    //     already at speed when the finger leaves, and easing *in* from that
    //     reads as a stutter followed by a jump.
    //
    // Snapping is switched off for the duration and restored at the end. A
    // `scroll-snap-type: x mandatory` container re-snaps after every scroll
    // it's given, including each per-frame `scrollLeft` we write, which would
    // quantise the animation into exactly the one-card hop we're replacing. The
    // target is always a whole multiple of the pitch, so by the time snapping
    // comes back the strip is already sitting on a snap point and nothing
    // moves.
    let rafId = 0;
    let snapOff = false;

    const restoreSnap = () => {
      if (!snapOff) return;
      snapOff = false;
      node.style.scrollSnapType = "";
    };

    /** Stop a glide where it stands, leaving snapping off — the caller decides
     *  when to hand control back, because restoring it under a finger that's
     *  still down would snap the strip out from under the drag. */
    const stopGlide = () => {
      if (!rafId) return;
      cancelAnimationFrame(rafId);
      rafId = 0;
    };

    const glideTo = (to: number) => {
      stopGlide();
      const from = node.scrollLeft;
      const dist = to - from;
      if (Math.abs(dist) < 1) {
        restoreSnap();
        return;
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        restoreSnap();
        node.scrollLeft = to;
        return;
      }

      node.style.scrollSnapType = "none";
      snapOff = true;

      const duration = Math.min(
        GLIDE_MAX_MS,
        GLIDE_MIN_MS + Math.abs(dist) * GLIDE_PER_PX,
      );
      const start = performance.now();
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        node.scrollLeft = from + dist * easeOutCubic(p);
        if (p < 1) {
          rafId = requestAnimationFrame(step);
          return;
        }
        rafId = 0;
        restoreSnap();
      };
      rafId = requestAnimationFrame(step);
    };

    const onTouchStart = (e: TouchEvent) => {
      // The catch. Whatever the strip was doing, it's the finger's now.
      stopGlide();
      const t = e.touches[0];
      if (!t) return;
      samples = [{ x: t.clientX, t: e.timeStamp }];
    };

    // Trackpads and mouse wheels don't produce touch events, and someone
    // scrolling the strip by other means should be able to interrupt a glide
    // too. Snapping goes straight back here because there's no finger down to
    // pull the strip out from under.
    const onWheel = () => {
      stopGlide();
      restoreSnap();
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

      if (boost === null) {
        // Not a flick. Hand the release back to the browser, whose own snap is
        // still the best one-card-at-a-time control there is — including when
        // the gesture that just ended was a *catch*, where letting go without
        // throwing should simply park on the nearest card.
        restoreSnap();
        return;
      }

      // Next frame, so this lands after the browser has committed the end of
      // the gesture — issued synchronously in the touchend handler it can be
      // overwritten by the native momentum that starts immediately after.
      requestAnimationFrame(() => glideTo(boost));
    };

    node.addEventListener("touchstart", onTouchStart, { passive: true });
    node.addEventListener("touchmove", onTouchMove, { passive: true });
    node.addEventListener("touchend", onTouchEnd, { passive: true });
    node.addEventListener("touchcancel", onTouchEnd, { passive: true });
    node.addEventListener("wheel", onWheel, { passive: true });

    return () => {
      stopGlide();
      restoreSnap();
      node.removeEventListener("scroll", onScroll);
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchmove", onTouchMove);
      node.removeEventListener("touchend", onTouchEnd);
      node.removeEventListener("touchcancel", onTouchEnd);
      node.removeEventListener("wheel", onWheel);
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
export function flickTarget(
  node: HTMLElement,
  samples: Sample[],
): number | null {
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
  const ramp = (speed - FLICK_MIN_SPEED) / (FLICK_MAX_SPEED - FLICK_MIN_SPEED);
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
