// Shared heart glyph — used by the Favorites tab in the bottom nav and by the
// favorite toggle on the recipe detail page.
//
// Both places previously inlined their own copy of a hand-written path that
// wasn't actually mirror-symmetric: the two lobes had different control
// points and the left one dipped lower than the right, so the top-center cusp
// sat off-axis and the glyph read as a cracked/broken heart at 24px.
//
// This is a symmetric two-arc construction instead: identical 5.5-radius arcs
// for the left and right lobes, meeting exactly at x=12, sweeping down to a
// single bottom point at (12, 21).
//
// No hooks and no client-only APIs, so it renders in both server and client
// components.
export function HeartIcon({
  filled,
  size = 24,
}: {
  filled: boolean;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 21 4.2 13.2a5.5 5.5 0 0 1 0-7.78 5.5 5.5 0 0 1 7.78 0L12 5.64l.02-.02a5.5 5.5 0 0 1 7.78 0 5.5 5.5 0 0 1 0 7.78L12 21Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
