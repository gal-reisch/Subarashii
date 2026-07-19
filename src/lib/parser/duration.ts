// Convert an ISO-8601 duration (e.g. "PT1H30M", "P0DT0H45M") to minutes.
export function isoDurationToMinutes(iso?: string | null): number | null {
  if (!iso || typeof iso !== "string") return null;
  const m = iso.match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/);
  if (!m) return null;
  const weeks = parseInt(m[1] || "0", 10);
  const days = parseInt(m[2] || "0", 10);
  const hours = parseInt(m[3] || "0", 10);
  const minutes = parseInt(m[4] || "0", 10);
  const total = weeks * 10080 + days * 1440 + hours * 60 + minutes;
  return total > 0 ? total : null;
}

// Extract the first integer from a recipeYield value ("4 servings", 4, ["4"]).
export function parseServings(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return parseServings(value[0]);
  if (typeof value === "string") {
    const m = value.match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }
  return null;
}
