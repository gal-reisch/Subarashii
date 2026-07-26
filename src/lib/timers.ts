// Detect a cooking duration inside a step's text, in seconds.
// Supports English ("10 minutes", "1.5 hours") and Hebrew ("10 דקות", "שעה",
// "שעתיים"). Returns null when no clear duration is present.
//
// The Hebrew minute unit also has to cover the abbreviation "דק" (with or
// without a geresh: "15 דק", "15 דק׳"), which is how people actually write it
// in captions — "נשאיר על להבה נמוכה ל15 דק" was silently producing no timer.
// The trailing lookahead is what keeps that short form from firing on the
// unrelated adjective דק ("thin/fine", as in "סוכר דק"): a real duration is
// always followed by punctuation or a space, never by more Hebrew letters.
//
// A range takes its upper bound ("10-15 דק" -> 15 min), which falls out of
// matching the digits nearest the unit. That's the right default for a
// kitchen timer — you'd rather check early than find it burnt.
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

  const min = t.match(
    /(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min|דקות|דקה|דק['׳]?(?![֐-׿]))/,
  );
  if (min) {
    seconds += parseFloat(min[1]) * 60;
    found = true;
  }

  return found && seconds > 0 ? Math.round(seconds) : null;
}
