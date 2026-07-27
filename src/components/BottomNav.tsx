"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOutAction } from "@/app/actions";
import { HeartIcon } from "@/components/HeartIcon";

// Fixed bottom tab bar, rebuilt to match the user's Figma `Nav Bar` component
// (file "Subarashii", node 1521:1044) verified via the Figma API — NOT the
// earlier paraphrased pass. Ground-truth facts from that component:
//   - The bar is a frosted-GLASS pill (translucent fill + backdrop blur),
//     not a solid card. In Figma it's a flattened image because the blur is
//     baked in; reproduced here with a semi-transparent fill + backdrop-blur.
//   - Five items: Home, Favorites (heart), a raised center "+" FAB, Shelves
//     (three horizontal bars), and an avatar labelled "Ella Reisch".
//   - Icons AND labels are pink (--accent / #f4a6d2); labels are Poppins
//     Medium (--font-heading @ 500).
//   - The FAB "+" glyph is CREAM (#fbf5e7) on the pink circle — not the
//     near-black --accent-ink used by text buttons.
//
// Sign-out isn't a Figma nav item; it lives behind a tap on the avatar so the
// function survives the restructure without adding a 6th slot.
export function BottomNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isFavorites = pathname?.startsWith("/favorites") ?? false;
  const isShelves = pathname?.startsWith("/collections") ?? false;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-5"
      style={{
        paddingBottom: "max(env(safe-area-inset-bottom), 1rem)",
        // Forces the bar onto its own compositor layer. A `position: fixed`
        // element that also has a backdrop-filter (the frosted-glass pill
        // below) is repainted by iOS Safari in step with the scrolling
        // content instead of being composited independently, so it visibly
        // lags or drifts during a momentum scroll and only settles once the
        // scroll ends. Promoting it means the compositor just holds it in
        // place. Paired with `overscroll-behavior-y: none` in globals.css,
        // which stops the rubber-band bounce that causes the same symptom.
        transform: "translateZ(0)",
        willChange: "transform",
      }}
    >
      {/* The fill is thinner than it looks like it should be — 55% white down
          to 40%, about a third more see-through — so the cards actually travel
          *under* the bar instead of disappearing behind a panel. Real frosted
          glass gives away what's behind it; that's the whole difference
          between glass and a tinted card.

          The blur goes up as the fill comes down. They're doing opposite jobs:
          the fill is what makes text on top of the bar legible, the blur is
          what stops whatever is behind it from being readable as *content*.
          Thin the fill without deepening the blur and you don't get glass, you
          get a window with a recipe title showing through the nav labels. */}
      <div className="relative flex w-full max-w-sm items-center rounded-full border border-white/45 bg-white/40 px-2 py-3 shadow-[0px_16px_40px_rgba(0,0,0,0.12)] backdrop-blur-2xl">
        <div className="flex flex-1 justify-center">
          <NavIcon href="/" label="Home" active={isHome}>
            <HomeIcon active={isHome} />
          </NavIcon>
        </div>

        <div className="flex flex-1 justify-center">
          <NavIcon href="/favorites" label="Favorites" active={isFavorites}>
            <HeartIcon filled={isFavorites} />
          </NavIcon>
        </div>

        {/* empty slot so the raised center FAB has room without overlapping
            the side icons */}
        <div className="flex flex-1 justify-center" aria-hidden>
          <span className="h-11 w-11" />
        </div>

        <div className="flex flex-1 justify-center">
          <NavIcon href="/collections" label="Shelves" active={isShelves}>
            <ShelvesIcon />
          </NavIcon>
        </div>

        <div className="flex flex-1 justify-center">
          <form action={signOutAction} className="contents">
            <button
              type="submit"
              aria-label="Ella — sign out"
              className="flex flex-col items-center justify-center gap-1 rounded-full transition active:scale-90"
            >
              <Avatar />
              <span className="font-heading text-[10px] font-medium leading-none text-accent">
                Ella
              </span>
            </button>
          </form>
        </div>

        <Link
          href="/add"
          aria-label="Add Recipe"
          // Prefetched like the other nav links; see the comment in NavIcon.
          className="absolute left-1/2 top-0 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-[#fbf5e7] shadow-[0px_10px_24px_rgba(244,166,210,0.5)] transition active:scale-95"
        >
          <PlusIcon />
        </Link>
      </div>
    </nav>
  );
}

function NavIcon({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      // Prefetch is deliberately left ON (the default), which reverses an
      // earlier decision here. It was disabled because Next.js prefetches
      // every in-viewport <Link> as soon as the nav mounts, and back when
      // this app used Supabase magic-link auth those 3-4 simultaneous
      // requests raced to redeem the same one-time-use refresh token; the
      // losers were treated as logged-out and Next cached the resulting
      // /login redirect per-route, so a tapped icon kept replaying a stale
      // bounce.
      //
      // That failure mode no longer exists. Task #24 replaced per-user auth
      // with a shared PIN, and the session cookie is now a deterministic
      // HMAC of a fixed message (src/lib/session.ts) — the proxy only
      // *verifies* a signature, redeeming nothing and mutating no state, so
      // concurrent requests are idempotent and can't race.
      //
      // Turning it back on is the main fix for taps feeling laggy. Every
      // page here is dynamic, so without a prefetch a tap can't render
      // anything until the server answers. With one, the layout and the
      // loading skeleton up to the first boundary are already in the client
      // cache, so the tap paints immediately and the content streams in
      // behind it. (Prefetching only runs in production builds, so this is
      // invisible in dev.)
      // Every glyph is pink per the Figma nav; the active tab just reads a
      // touch heavier (full-opacity fill + soft pink glow) vs. the ~65%
      // opacity of inactive tabs.
      className={`flex h-11 w-11 flex-col items-center justify-center gap-1 rounded-full text-accent transition active:scale-90 ${
        active ? "drop-shadow-[0_4px_8px_rgba(244,166,210,0.45)]" : "opacity-65"
      }`}
    >
      {children}
      <span className="font-heading text-[10px] font-medium leading-none">{label}</span>
    </Link>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8.5Z"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Three stacked horizontal rounded bars — matches the Figma "Shelves" glyph
// (three pink rounded rectangles), replacing the old jars-on-a-shelf icon.
function ShelvesIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="6" width="16" height="3" rx="1.5" fill="currentColor" />
      <rect x="4" y="10.5" width="16" height="3" rx="1.5" fill="currentColor" />
      <rect x="4" y="15" width="16" height="3" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

// Ella's avatar — a pre-circle-masked PNG (public/avatar-ella.png, sourced
// from scripts/assets/ella-avatar-source.png; the source had a solid white
// square canvas around the pink circle art, so it's center-cropped to a
// square and clipped to a circle via an SVG alpha mask in a one-off sharp
// script rather than committing that logic to gen-icons.mjs, since it's a
// single fixed asset, not a per-size icon pipeline). `rounded-full
// overflow-hidden` here is a belt-and-suspenders clip in case the source PNG
// is ever swapped for one that isn't already pre-masked.
function Avatar() {
  return (
    <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full ring-1 ring-white/70">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/avatar-ella.png" alt="" className="h-full w-full object-cover" />
    </span>
  );
}
