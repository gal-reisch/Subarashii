// Detect a cooking duration inside a step's text, in seconds.
// Supports English ("10 minutes", "1.5 hours") and Hebrew ("10 דקות", "שעה",
// "שעתיים"). Returns null when no clear duration is present.
export function detectTimerSeconds(text: string): number | null {
  if (!text) return null;
  const t = text.toLowerCase();
  let seconds = 0;
  let found = false;

  if (/שעתיים/.test(text)) {
    seconds += 2 * 3600;
    found = true;
  }

  const hour = t.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|hour|שעות|שעה)/);
  if (hour) {
    seconds += parseFloat(hour[1]) * 3600;
    found = true;
  }

  const min = t.match(/(\d+(?:\.\d+)?)\s*(minutes?|mins?|min|דקות|דקה)/);
  if (min) {
    seconds += parseFloat(min[1]) * 60;
    found = true;
  }

  return found && seconds > 0 ? Math.round(seconds) : null;
}
