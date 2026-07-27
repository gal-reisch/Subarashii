"use client";

// Last-resort boundary for errors thrown by the root layout itself, where
// `error.tsx` can't help because the layout that would wrap it is the thing
// that failed. Replaces the root layout entirely, so it has to bring its own
// <html>/<body> — and it can't rely on the font CSS variables the real layout
// sets, hence the plain system-font inline styles rather than Tailwind
// classes that reference app tokens.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.75rem",
          padding: "1.25rem",
          textAlign: "center",
          background: "#fcfdf7",
          color: "#6c003d",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", margin: 0 }}>
          The whole thing fell over.
        </h1>
        <p style={{ margin: 0, color: "#8a7f76", fontSize: "0.875rem" }}>
          Nothing was lost. Reloading usually sorts it out.
        </p>
        {error.digest && (
          <p
            style={{
              margin: 0,
              color: "#8a7f76",
              fontSize: "0.6875rem",
              fontFamily: "ui-monospace, monospace",
            }}
          >
            ref {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={() => unstable_retry()}
          style={{
            marginTop: "0.5rem",
            border: 0,
            borderRadius: "999px",
            background: "#f4a6d2",
            color: "#6c003d",
            padding: "0.75rem 1.5rem",
            fontWeight: 600,
            fontSize: "1rem",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
