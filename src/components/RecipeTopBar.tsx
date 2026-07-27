"use client";

import { useEffect, useState } from "react";

// The recipe page's top bar: a back button and the two filing controls, pinned
// to the top and out of the way while you're reading.
//
// Deliberately not a pill. It was one — the same frosted capsule as the bottom
// nav — and floating a bordered, shadowed object over the top of a recipe made
// the controls look like a thing sitting on the page rather than part of it,
// competing with the cover image for the top of the screen. The bottom nav
// earns its capsule because it's the app's furniture and belongs to no page;
// this bar belongs to the recipe under it. So it's full-bleed, the same cream
// as the background, and the only edge it draws is a hairline where it meets
// the content — and only once there's content behind it to separate from.
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

/** Past this, the page has actually moved under the bar and the separator has
 *  something to separate. At rest the line would just be a stray rule across
 *  an empty cream header. */
const SEPARATOR_AFTER = 4;

export function RecipeTopBar({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);
  const [separated, setSeparated] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const evaluate = () => {
      ticking = false;
      const y = window.scrollY;
      setSeparated(y > SEPARATOR_AFTER);

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
      // Keyboard focus can still reach these controls while the bar is parked
      // off-screen, and a focus ring you can't see is worse than no bar at
      // all. Tabbing into it brings it back.
      onFocusCapture={() => setVisible(true)}
      // Translated rather than unmounted or `display: none`d: the transform is
      // composited, so the bar slides away without laying anything out, and the
      // controls keep their DOM identity (a half-open shelf sheet isn't torn
      // down because you scrolled).
      //
      // The whole fixed box moves now, not an inner pill inside a stationary
      // wrapper, so there's no leftover full-width element sitting over the top
      // of the recipe swallowing taps while the bar is away — which is what the
      // old `pointer-events-none`/`-auto` pair was there to prevent. `-full` is
      // exactly its own height and there's no drop shadow left to clear.
      className={`fixed inset-x-0 top-0 z-30 border-b bg-background/85 backdrop-blur-xl transition-[transform,border-color] duration-300 ease-out motion-reduce:transition-none ${
        visible ? "translate-y-0" : "-translate-y-full"
      } ${separated ? "border-border/70" : "border-transparent"}`}
      style={{
        paddingTop: "max(env(safe-area-inset-top), 0.5rem)",
        // Same reason as the bottom nav: iOS Safari repaints a fixed element
        // that also has a backdrop-filter in step with the scrolling content
        // rather than compositing it separately, so it drifts during a
        // momentum scroll unless it's forced onto its own layer. Note this is
        // the `transform` property while the show/hide above rides on Tailwind
        // v4's `translate` property — they compose rather than overwrite each
        // other, which is why both can be here.
        transform: "translateZ(0)",
        willChange: "transform",
      }}
    >
      {/* Matches <main>'s `max-w-2xl px-5` so the back button lines up with the
          recipe text rather than with the screen edge. */}
      <div className="mx-auto flex max-w-2xl items-center justify-between px-5 pb-2">
        {children}
      </div>
    </div>
  );
}
