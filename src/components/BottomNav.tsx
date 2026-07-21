"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOutAction } from "@/app/actions";

// Fixed bottom tab bar — replaces the old floating collapsible menu, to match
// the reference design's icon-only bottom nav with a raised, accent-colored
// primary action in the center. "Add Recipe" sits in that center slot: in
// mobile nav conventions (Instagram, TikTok) the raised center button reads
// as *the* primary action at a glance, which is what "first and most
// important" means visually even though it isn't first in DOM order.
export function BottomNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isShelves = pathname?.startsWith("/collections") ?? false;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-6"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1rem)" }}
    >
      <div className="relative flex w-full max-w-xs items-center rounded-full bg-card px-2 py-3 shadow-[0px_20px_40px_rgba(0,0,0,0.12)]">
        <div className="flex flex-1 justify-center">
          <NavIcon href="/" label="Home" active={isHome}>
            <HomeIcon active={isHome} />
          </NavIcon>
        </div>

        <div className="flex flex-1 justify-center">
          <NavIcon href="/collections" label="Shelves" active={isShelves}>
            <ShelvesIcon active={isShelves} />
          </NavIcon>
        </div>

        {/* empty slot so the raised center button below has room to sit
            without overlapping the two side icons */}
        <div className="flex flex-1 justify-center" aria-hidden>
          <span className="h-11 w-11" />
        </div>

        <div className="flex flex-1 justify-center">
          <form action={signOutAction} className="contents">
            <button
              type="submit"
              aria-label="Sign out"
              className="flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-full text-muted transition active:scale-90"
            >
              <SignOutIcon />
              <span className="text-[10px] font-bold leading-none">Sign out</span>
            </button>
          </form>
        </div>

        <Link
          href="/add"
          aria-label="Add Recipe"
          className="absolute left-1/2 top-0 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-accent-ink shadow-[0px_10px_24px_rgba(191,74,26,0.5)] transition active:scale-95"
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
      className={`flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-full transition active:scale-90 ${
        active ? "text-accent drop-shadow-[0_4px_8px_rgba(191,74,26,0.45)]" : "text-muted"
      }`}
    >
      {children}
      <span className="text-[10px] font-bold leading-none">{label}</span>
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

// A literal little shelf — a baseline with a few jars/books of different
// heights resting on it — rather than a bookmark/ribbon shape, which people
// kept reading as "save this page" instead of "your recipe shelves".
function ShelvesIcon({ active }: { active: boolean }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="4.5" y="10" width="3.4" height="9" rx="1" fill="currentColor" opacity={active ? 1 : 0.85} />
      <rect x="10.3" y="6" width="3.4" height="13" rx="1" fill="currentColor" />
      <rect x="16.1" y="12" width="3.4" height="7" rx="1" fill="currentColor" opacity={active ? 1 : 0.85} />
      <path d="M3 19.5h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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

function SignOutIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M15 17v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1M18.5 12H10M18.5 12l-3-3M18.5 12l-3 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
