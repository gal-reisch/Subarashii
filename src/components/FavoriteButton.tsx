"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HeartIcon } from "@/components/HeartIcon";
import { toggleFavoriteAction } from "@/app/actions";
import { showToast } from "@/lib/toast";

// The heart in the recipe page's top bar, plus the small celebration it sets
// off. Was a plain `<form action={toggleFavoriteAction}>` rendered inline on
// the server; it's a client component now only because the burst needs to
// pick random angles at the moment of the tap.
//
// The form itself is untouched by that. Same action, same hidden fields, same
// plain submit — so the actual favouriting still works if the JS never
// arrives, and the burst is the part that's allowed to be missing.

// Rainbows, unicorns and sparkles, as asked for. Sparkles outnumber the other
// two: they're the small filler that makes a burst read as a burst, while a
// screenful of unicorns reads as a screenful of unicorns.
const EMOJI = ["✨", "🌈", "✨", "🦄", "✨", "🌈", "✨", "🦄"];

const PARTICLE_COUNT = 14;
/** Matches the `emoji-burst` animation duration in globals.css, plus a
 *  little slack, after which the particle is removed from the DOM. */
const BURST_MS = 950;

interface Particle {
  id: number;
  char: string;
  dx: number;
  dy: number;
  rot: number;
  size: number;
  delay: number;
  /** Viewport coordinates of the heart's centre, captured at the tap. The
   *  particles are `position: fixed` (see globals.css for why), so they need
   *  an explicit origin rather than inheriting one from a positioned
   *  ancestor. */
  originX: number;
  originY: number;
}

let nextId = 0;

function makeBurst(originX: number, originY: number): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    // Evenly spaced around the full circle, then jittered. Even spacing alone
    // looks like a clock face; jitter alone leaves gaps and clumps. The ask
    // was for it to burst *around* the thumb, so this is a full 360° rather
    // than the upward fan a "like" button usually gets.
    const angle =
      (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
    const distance = 42 + Math.random() * 46;
    return {
      id: nextId++,
      char: EMOJI[i % EMOJI.length],
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance,
      // Degrees, signed, so roughly half tumble each way.
      rot: (Math.random() - 0.5) * 180,
      size: 13 + Math.random() * 9,
      // A few milliseconds of stagger. Everything leaving on the same frame
      // looks mechanical; this is short enough to read as one event.
      delay: Math.random() * 90,
      originX,
      originY,
    };
  });
}

export function FavoriteButton({
  recipeId,
  isFavorite,
}: {
  recipeId: string;
  isFavorite: boolean;
}) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Held so the component can clean up if it unmounts mid-burst (navigating
  // away between the tap and the fade), which would otherwise leave a timer
  // pointing at a dead tree.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  function onActivate() {
    if (isFavorite) {
      // Un-favouriting gets the note but not the parade. Confirmation is
      // still useful; confetti for taking something away is not.
      showToast("Removed from favorites");
      return;
    }
    showToast("Recipe added to favorites", "💖");

    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const burst = makeBurst(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    setParticles((prev) => [...prev, ...burst]);

    const ids = new Set(burst.map((p) => p.id));
    const timer = setTimeout(() => {
      setParticles((prev) => prev.filter((p) => !ids.has(p.id)));
    }, BURST_MS + 100);
    timers.current.push(timer);
  }

  return (
    <form action={toggleFavoriteAction}>
      <input type="hidden" name="recipe_id" value={recipeId} />
      <input type="hidden" name="is_favorite" value={String(isFavorite)} />
      <button
        ref={buttonRef}
        type="submit"
        onClick={onActivate}
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={isFavorite}
        className="flex h-10 w-10 items-center justify-center rounded-full text-accent transition active:scale-90"
      >
        <HeartIcon filled={isFavorite} />
      </button>

      {/* Portalled to <body> rather than rendered in place. Two reasons, both
          structural: the particles are `position: fixed` and would be trapped
          by any transformed ancestor (the same containing-block rule that broke
          the delete dialog), and rendering them here would put them inside the
          <form> that the click is currently submitting.

          `pointer-events-none` on every particle so the layer, which sits over
          the heart, can't swallow a second tap. */}
      {particles.length > 0 &&
        createPortal(
          <span aria-hidden>
            {particles.map((p) => (
              <span
                key={p.id}
                className="emoji-burst-particle"
                style={
                  {
                    left: p.originX,
                    top: p.originY,
                    // Read by the `emoji-burst` keyframes. Unitless numbers
                    // rather than lengths, because the keyframes multiply them
                    // (`calc(var(--dx) * 1px)`) — a `<length>` here couldn't be
                    // scaled that way by the reduced-motion variant.
                    "--dx": p.dx,
                    "--dy": p.dy,
                    "--rot": `${p.rot}deg`,
                    fontSize: `${p.size}px`,
                    animationDelay: `${p.delay}ms`,
                  } as React.CSSProperties
                }
              >
                {p.char}
              </span>
            ))}
          </span>,
          document.body,
        )}
    </form>
  );
}
