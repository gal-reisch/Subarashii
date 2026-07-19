import Link from "next/link";
import { signOutAction } from "@/app/actions";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-5 py-3 backdrop-blur">
      <Link href="/" className="text-2xl font-semibold text-accent">
        Subarashii
      </Link>
      <div className="flex items-center gap-3">
        <Link href="/collections" className="text-sm font-semibold text-muted hover:underline">
          Shelves
        </Link>
        <Link
          href="/add"
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition active:scale-95"
        >
          + Add
        </Link>
        <form action={signOutAction}>
          <button type="submit" className="text-sm text-muted hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
