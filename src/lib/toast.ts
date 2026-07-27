// A one-line "that worked" note, shown briefly at the bottom of the screen.
//
// Deliberately not a context provider. The two things that raise a toast —
// the favourite heart on the recipe page and the shelf rows inside the shelf
// sheet — have no ancestor in common except the root layout, so a provider
// would mean wrapping the whole app in a client component just to pass a
// function down through two unrelated trees. A DOM event is already a
// global channel with a subscriber model, and it costs nothing.
//
// It also keeps `showToast` importable from anywhere without dragging a hook
// along: a plain function, callable from an event handler, a form action's
// callback, or a `startTransition`. The <Toaster> mounted in the layout is
// the only listener.

/** Event name. Namespaced because it's dispatched on `window`, which is
 *  everyone's namespace. */
const EVENT = "subarashii:toast";

export interface ToastDetail {
  message: string;
  /** Optional emoji shown before the message. */
  icon?: string;
}

export function showToast(message: string, icon?: string) {
  // Guard for the server: these are called from client components, but a
  // module-level import of this file is evaluated during SSR too, and a
  // stray call from a code path that also runs on the server should be a
  // no-op rather than a crash.
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ToastDetail>(EVENT, { detail: { message, icon } }),
  );
}

export function onToast(handler: (detail: ToastDetail) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<ToastDetail>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

// Rotating copy for "you put this on a shelf". The ask was a line in the
// register of "look at you, organizing everything" — pleased with you, mildly
// teasing, never congratulatory in the productivity-app sense. Same deadpan
// voice as the delete dialog and the home headlines.
//
// Rotating rather than fixed because the whole joke is one you can only tell
// once; on the third shelf in a row the same sentence stops being a wink and
// starts being a system message.
const SHELVED_LINES = [
  "Look at you, organizing everything.",
  "Filed. Very put-together of you.",
  "That's the tidiest thing anyone's done today.",
  "On the shelf. Look at you go.",
  "Sorted. You're a whole system now.",
  "Neatly done. Suspiciously neat, actually.",
  "Filed away like someone with a plan.",
  "Shelved. Marie Kondo could never.",
  "Look at you, having a filing system.",
  "In its place. Deeply satisfying.",
];

/** A fresh line each time a recipe is filed. Called from an event handler,
 *  never during render — `Math.random()` in a render body is both a lint
 *  error here (`react-hooks/purity`) and a hydration mismatch waiting to
 *  happen. */
export function shelvedLine(): string {
  return SHELVED_LINES[Math.floor(Math.random() * SHELVED_LINES.length)];
}
