import { verifyPinAction } from "@/app/login/actions";
import { buttonClass } from "@/components/Button";

// Shared-PIN entry screen (task #24 PIN-auth migration, replacing Supabase
// magic-link auth). Plain server-action form — no client JS needed, so it
// works even if the PWA's service worker is in a weird state.
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage =
    error === "pin"
      ? "That's not the right PIN — try again."
      : error === "rate"
        ? "Too many attempts — wait a minute and try again."
        : null;

  return (
    <main className="min-h-full flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-5xl text-accent">Subarashii</h1>
        <p className="mt-3 text-muted">Ella&apos;s recipe box.</p>

        <form action={verifyPinAction} className="mt-10 flex flex-col gap-3">
          <input
            name="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            required
            autoFocus
            placeholder="PIN"
            className="rounded-[10px] border border-accent bg-white px-4 py-3.5 text-center text-lg tracking-[0.3em] outline-none shadow-[0px_10px_40px_0px_rgba(0,0,0,0.03)] focus:shadow-[0px_0px_0px_2px_var(--accent)]"
          />
          <button type="submit" className={buttonClass("primary")}>
            Unlock
          </button>
          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
        </form>
      </div>
    </main>
  );
}
