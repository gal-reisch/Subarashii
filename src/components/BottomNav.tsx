"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOutAction } from "@/app/actions";

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
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
    >
      <div className="relative flex w-full max-w-sm items-center rounded-full border border-white/60 bg-white/55 px-2 py-3 shadow-[0px_16px_40px_rgba(0,0,0,0.12)] backdrop-blur-xl">
        <div className="flex flex-1 justify-center">
          <NavIcon href="/" label="Home" active={isHome}>
            <HomeIcon active={isHome} />
          </NavIcon>
        </div>

        <div className="flex flex-1 justify-center">
          <NavIcon href="/favorites" label="Favorites" active={isFavorites}>
            <HeartIcon active={isFavorites} />
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

// Heart for the Favorites tab — outline when inactive, filled when the
// /favorites route is active (matching the Figma component's filled-pink
// heart in its selected state).
function HeartIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 20s-7-4.35-9.33-8.5C1.1 8.6 2.5 5.5 5.6 5.5c1.9 0 3.2 1.1 4.4 2.6 1.2-1.5 2.5-2.6 4.4-2.6 3.1 0 4.5 3.1 2.93 6C19 15.65 12 20 12 20Z"
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

// Placeholder avatar for "Ella" — the Figma nav uses a real photo (a masked
// image layer), which we don't have yet. A pink-tinted initial circle stands
// in until a real photo is provided, styled to read as an avatar rather than
// another icon. TODO(task #24 follow-up): swap in Ella's actual photo.
function Avatar() {
  return (
    <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-accent/25 font-heading text-[13px] font-semibold text-accent ring-1 ring-white/70">
      E
    </span>
  );
}
