import Link from "next/link";

// Bare circular chevron-left, matching the reference design's minimal top-bar
// back control — replaces the old "← Back to the box" text link everywhere.
export function BackButton({
  href,
  label = "Back",
  /** `"plain"` drops the card fill and shadow, for when this already sits on
   *  a raised surface — the recipe page's glass top bar, where a shadowed
   *  white disc inside a frosted pill reads as a button stuck onto another
   *  button. */
  variant = "raised",
}: {
  href: string;
  label?: string;
  variant?: "raised" | "plain";
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={`flex h-10 w-10 items-center justify-center rounded-full transition active:scale-90 ${
        variant === "raised"
          ? "bg-card shadow-[0px_6px_16px_rgba(0,0,0,0.08)]"
          : "text-accent"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path
          d="M15 18 9 12l6-6"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
