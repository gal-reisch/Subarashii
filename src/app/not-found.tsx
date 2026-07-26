import Link from "next/link";

// Shown by `notFound()` — most often after deleting a recipe and then hitting
// Back, which replays the now-dead /recipe/[id] URL. Without this the default
// bare 404 reads like a crash; the point here is to make that case obviously
// benign and give a way back to the box.
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 text-center">
      <h1 className="text-2xl">Nothing here.</h1>
      <p className="mt-2 text-sm text-muted">
        This recipe was probably deleted. That was likely on purpose.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-accent px-6 py-3 font-heading font-semibold text-accent-ink shadow-[0px_10px_24px_rgba(244,166,210,0.5)] transition active:scale-95"
      >
        Back to the box
      </Link>
    </div>
  );
}
