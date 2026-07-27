"use client";

import { useEffect, useState } from "react";

// The recipe page's top bar: the same frosted-glass pill as the bottom nav,
// pinned to the top, and out of the way while you're reading.
//
// It used to be an ordinary row at the top of the document, which meant that
// getting back to the box from halfway down a long recipe was a scroll all the
// way up first. Making it simply `fixed` would fix that and introduce a worse
// problem — a permanent bar over the top of every recipe, on the screen whose
// entire job is showing you the recipe.
//
// So it follows the scroll direction, which is the same bargain a phone's
// browser chrome makes: reading is downward, so downward means get out of the
// way; reaching for a control is a scroll back up, so upward means come back
// immediately, at whatever depth you're at.
//
// The controls themselves are passed in as children so the server page can go
// on rendering them with its own data (shelf memberships, favourite state) —
// this component knows about scrolling and nothing else.

/** Below this many pixels the bar is always shown, regardless of direction.
 *  Near the top of the page it isn't covering anything anyone is reading, and
 *  hiding it there makes the very first flick feel like the page ate a
 *  control. */
const ALWAYS_VISIBLE_ABOVE = 72;

/** Movement smaller than this doesn't count as a direction. Without it, the
 *  one-pixel jitter at the end of a momentum scroll — and the scroll anchoring
 *  that fires when an image finishes loading — flickers the bar. Because the
 *  reference point only moves when the threshold is crossed, slow scrolling
 *  still accumulates and eventually triggers. */
const DIRECTION_THRESHOLD = 8;

export function RecipeTopBar({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const evaluate = () => {
      ticking = false;
      const y = window.scrollY;

      if (y < ALWAYS_VISIBLE_ABOVE) {
        lastY = y;
        setVisible(true);
        return;
      }

      const dy = y - lastY;
      if (Math.abs(dy) < DIRECTION_THRESHOLD) return;
      lastY = y;
      setVisible(dy < 0);
    };

    // Coalesced to one evaluation per frame. `scroll` fires far more often
    // than that during a momentum scroll, and each one would otherwise be a
    // setState — cheap individually, but this is exactly the moment the page
    // can least afford main-thread work.
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(evaluate);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      // `pointer-events-none` on the full-width outer box, re-enabled on the
      // pill itself: parked off-screen the pill can't be hit, but this box
      // stays where it is, and without this it would leave the top 70px of
      // every recipe dead to taps exactly when the bar is meant to be gone.
      className="pointer-events-none fixed inset-x-0 top-0 z-30 flex justify-center px-5"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 0.75rem)",
        // Same reason as the bottom nav: iOS Safari repaints a fixed element
        // that also has a backdrop-filter in step with the scrolling content
        // rather than compositing it separately, so it drifts during a
        // momentum scroll unless it's forced onto its own layer.
        transform: "translateZ(0)",
        willChange: "transform",
      }}
    >
      <div
        // Keyboard focus can still reach these controls while the bar is
        // parked off-screen, and a focus ring you can't see is worse than no
        // bar at all. Tabbing into it brings it back.
        onFocusCapture={() => setVisible(true)}
        // Translated rather than unmounted or `display: none`d: the transform
        // is composited, so the bar slides away without laying anything out,
        // and the controls keep their DOM identity (a half-open shelf sheet
        // isn't torn down because you scrolled).
        //
        // `-translate-y-[200%]` overshoots deliberately — the pill has to clear
        // its own drop shadow as well as its box, and 100% leaves a grey smear
        // along the top edge.
        className={`pointer-events-auto flex w-full max-w-2xl items-center justify-between rounded-full border border-white/60 bg-white/55 px-3 py-2 shadow-[0px_16px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
          visible ? "translate-y-0" : "-translate-y-[200%]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
