"use client";

import { useEffect } from "react";

// Route-level error boundary.
//
// Before this file existed the app had NO error boundary anywhere, which is
// why a failed delete showed up as a blank white page: an uncaught error in a
// Server Component or Server Action unmounts the whole tree, and with no
// boundary to catch it React renders nothing at all. In production the
// message is redacted too, so there wasn't even a console breadcrumb — just
// silence. Anything that throws from here on lands here instead.
//
// NOTE: the retry prop is `unstable_retry` in this version of Next, not the
// `reset` that older App Router code (and most examples) use — verified in
// node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md.
export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // No error-reporting service wired up; the console is the only sink. The
    // digest is the one thing that survives production redaction, so it's
    // what makes a user-reported failure traceable to a server log.
    console.error("[subarashii] route error", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-5 text-center">
      <h1 className="text-2xl">Well, that didn&rsquo;t work.</h1>
      <p className="mt-2 text-sm text-muted">
        Something broke on our side. Your recipes are fine — this page just
        couldn&rsquo;t put itself together.
      </p>

      {error.digest && (
        <p className="mt-4 font-mono text-[11px] text-muted/70">
          ref {error.digest}
        </p>
      )}

      <button
        type="button"
        onClick={() => unstable_retry()}
        className="mt-6 rounded-full bg-accent px-6 py-3 font-heading font-semibold text-accent-ink shadow-[0px_10px_24px_rgba(244,166,210,0.5)] transition active:scale-95"
      >
        Try again
      </button>
    </div>
  );
}
