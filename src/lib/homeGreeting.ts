// The home page headline.
//
// This replaces a flat list of 25 interchangeable prompts (the old
// HOME_PROMPTS). Two things were wrong with it.
//
// First, some of those lines referred to the time of day — "Something easy
// tonight?" — while being picked at random, so the app would ask about dinner
// at nine in the morning. Second, and the user's actual words: the tone was
// "very generic". They were lines that would fit any recipe app, in a box that
// belongs to exactly one person.
//
// So a line is now assembled from three things the app actually knows:
//
//   1. Her name. Not on every line — a greeting that uses your name every
//      single time stops sounding like a person and starts sounding like a
//      mail merge. Roughly a third of the pool.
//   2. What's in her box. Counts only, never titles: a recipe title is
//      usually Hebrew, and dropping Hebrew into the middle of an English
//      sentence needs bidi isolation the <h1> can't express as a plain
//      string. Counts say something true about her box without that problem.
//   3. The day and hour, including the ones that mean something specific in
//      an Israeli household — Friday afternoon is when Shabbat dinner gets
//      cooked, and Saturday is not a day for a "what's for dinner" nudge.
//
// The copy rules from the old file still hold and additions should follow
// them: ask or invite, don't instruct; no marketing verbs ("Discover",
// "Explore"); no emoji; no exclamation marks. Length is no longer a
// constraint — the <h1> wraps and balances.

/** Sunday is 0, matching `Date.prototype.getDay`. Israel's week starts on
 *  Sunday, so this is also the local week order rather than a coincidence. */
const FRIDAY = 5;
const SATURDAY = 6;

export type Daypart =
  | "lateNight"
  | "morning"
  | "midday"
  | "afternoon"
  | "evening"
  | "night";

/** What the headline knows about her box. Counts, not contents — see the
 *  note above about Hebrew titles inside English sentences. */
export interface BoxContext {
  total: number;
  /** Saved since the start of this week (Sunday), so "new this week" means
   *  what it means locally rather than counting back a rolling seven days. */
  addedThisWeek: number;
  /** Imports that didn't fully parse and still want a human. */
  needsReview: number;
  /** Recipes at or under half an hour. */
  quick: number;
}

export function daypartFor(hour: number): Daypart {
  if (hour < 5) return "lateNight";
  if (hour < 11) return "morning";
  if (hour < 15) return "midday";
  if (hour < 18) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

// The clock the headline runs on is the *device's*, which is the whole point
// of the change — but the page is server-rendered, and a server renders in
// whatever zone it was deployed into (UTC, on Vercel). Computing the hour
// server-side is exactly the bug being fixed: it would put Israel three hours
// into the past and ask about lunch at teatime.
//
// So the hour travels as an opaque key rather than as a rendered line. The
// server produces one for a sensible default zone, the client produces one
// from the actual device, and `HomeGreeting` swaps between them through
// useSyncExternalStore — which is the hook that exists for values that differ
// legitimately between server and client, and avoids both a hydration
// mismatch and a visible flash in the (overwhelmingly common) case where the
// two agree.

/** The household's zone. Used only for the server's first guess, which the
 *  device corrects on hydration if she's somewhere else. */
export const DEFAULT_TIME_ZONE = "Asia/Jerusalem";

const WEEKDAYS: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** `"<weekday>:<hour>"`. A primitive, because useSyncExternalStore compares
 *  snapshots by identity and an object would re-render forever. */
export function dayKey(now: Date, timeZone?: string): string {
  if (!timeZone) return `${now.getDay()}:${now.getHours()}`;

  // `hourCycle: "h23"` rather than `hour12: false`, which still renders
  // midnight as "24" in some implementations.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "0";
  return `${WEEKDAYS[weekday] ?? 0}:${parseInt(hour, 10)}`;
}

/** The instant of the most recent Sunday 00:00 in `timeZone`.
 *
 *  Measured as "how far into the local week are we, subtracted from now",
 *  which avoids constructing a Date in another zone — the usual
 *  `new Date(d.toLocaleString(...))` trick, which round-trips through a string
 *  and is wrong in ways that are hard to see. A DST shift mid-week can move
 *  this by an hour; for counting what was saved this week, that doesn't
 *  matter. */
export function startOfWeekMs(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);

  const at = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const elapsed =
    (WEEKDAYS[at("weekday")] ?? 0) * 86_400_000 +
    Number(at("hour")) * 3_600_000 +
    Number(at("minute")) * 60_000 +
    Number(at("second")) * 1_000;

  return now.getTime() - elapsed;
}

/** A fresh seed for one page load, in [0, 1).
 *
 *  Here rather than inline in the page because `Math.random()` written into a
 *  component's render is what `react-hooks/purity` forbids, and for a good
 *  reason: a value that changes on every re-render makes the output unstable.
 *  That reason doesn't apply to an async server component rendered once per
 *  request — but the honest fix isn't to silence the rule, it's to treat the
 *  seed as what it is. It's request state, picked once alongside the recipe
 *  list and then held fixed as a prop for the life of the page, which is
 *  exactly what stops the headline reshuffling when the client corrects the
 *  clock. */
export function newSeed(): number {
  return Math.random();
}

interface Line {
  text: string;
  /** Relative likelihood within the eligible pool. Above 1 for lines that
   *  should usually win when they apply at all (Friday evening), below 1 for
   *  ones that are true but a bit task-ish to lead with. */
  weight: number;
}

const NAME = "Ella";

const BY_DAYPART: Record<Daypart, string[]> = {
  lateNight: [
    `It's late, ${NAME}. Something small?`,
    "Still up? Something quick, then.",
    "This is a midnight-snack sort of hour.",
    "Late. Toast counts, for the record.",
  ],
  morning: [
    `Morning, ${NAME}. Eggs, or something with more ambition?`,
    "Morning. What's the first thing today?",
    "Coffee first. Then what?",
    "Slow start, or straight out the door?",
  ],
  midday: [
    `Lunch, ${NAME}?`,
    "Something that doesn't need the oven?",
    "What's for lunch?",
    "A proper sit-down lunch, or something standing up?",
  ],
  afternoon: [
    `Afternoon, ${NAME}. Thinking about dinner yet?`,
    "Getting to that hour. What's the plan for tonight?",
    "Want to start something now so it's ready later?",
    "Anything out of the freezer yet?",
  ],
  evening: [
    `Evening, ${NAME}. What are we making?`,
    "What are we having tonight?",
    "Something quick, or something worth the wait?",
    "Dinner. Where are we starting?",
  ],
  night: [
    `Late-ish. Keep it simple tonight, ${NAME}?`,
    "Winding down. Anything small?",
    "It's that hour where everything sounds like too much effort.",
  ],
};

// Friday and Saturday carry weight here that they don't carry in a generic
// recipe app: Friday afternoon is when Shabbat dinner actually gets cooked,
// and Saturday is the day not to be nudged about dinner at all.
const EREV_SHABBAT: string[] = [
  `Friday, ${NAME}. What's going on the table tonight?`,
  "Erev Shabbat. What are we cooking?",
  "Anything that needs to go in the oven now?",
  "Big table tonight, or a quiet one?",
  "Friday. Where are we starting?",
];

const FRIDAY_MORNING: string[] = [
  `Friday morning, ${NAME}. Shopping, or straight to cooking?`,
  "Friday. Want to get ahead of tonight?",
  "It's Friday. Plenty of time, for now.",
];

const SHABBAT: string[] = [
  "Shabbat. Leftovers, or something new?",
  `No rush today, ${NAME}.`,
  "Slow Saturday. Anything you feel like making?",
  "Saturday. Cook only if you want to.",
];

const EMPTY_BOX: string[] = [
  `Nothing in here yet, ${NAME}. Let's fix that.`,
  "An empty box. Save something and it'll show up here.",
  "This is where your recipes will live.",
];

const plural = (n: number) => (n === 1 ? "" : "s");

/** Lines that depend on what's actually in the box. Only the applicable ones
 *  join the pool, so a quiet box just falls back to the day and hour. */
function boxLines(box: BoxContext, daypart: Daypart, weekday: number): Line[] {
  const out: Line[] = [];

  // On Sunday, "this week" and "since Sunday" both mean today — and saying
  // "since Sunday" on a Sunday reads as a much longer stretch than it is.
  const sunday = weekday === 0;
  if (box.addedThisWeek === 1) {
    out.push({
      text: sunday
        ? `You saved something new today, ${NAME}. Tonight?`
        : `You saved something new this week, ${NAME}. Tonight?`,
      weight: 1.5,
    });
  } else if (box.addedThisWeek > 1) {
    out.push({
      text: sunday
        ? `${box.addedThisWeek} new ones in here today. Any of them tonight?`
        : `${box.addedThisWeek} new ones in here since Sunday. Any of them tonight?`,
      weight: 1.5,
    });
  }

  if (box.needsReview > 0) {
    // Lower weight: true, and worth surfacing, but "you have chores" is a
    // thin thing to open the app with.
    out.push({
      text:
        box.needsReview === 1
          ? "One in here didn't import cleanly. Want to sort it out?"
          : `${box.needsReview} in here didn't import cleanly. Want to sort them out?`,
      weight: 0.4,
    });
  }

  // Only when the hour makes "quick" the relevant axis.
  if (box.quick >= 3 && (daypart === "evening" || daypart === "night" || daypart === "midday")) {
    out.push({
      text: `${box.quick} things in here take under half an hour.`,
      weight: 1,
    });
  }

  if (box.total >= 10) {
    out.push({
      text: `${box.total} recipe${plural(box.total)} in here, ${NAME}. Still deciding?`,
      weight: 0.6,
    });
  }

  return out;
}

/**
 * @param key   from `dayKey()` — the device's weekday and hour.
 * @param seed  a number in [0, 1). Chosen once per page load on the server so
 *              the line doesn't reshuffle when the client corrects the clock.
 */
export function homeGreeting(key: string, box: BoxContext, seed: number): string {
  const [weekdayRaw, hourRaw] = key.split(":");
  const weekday = Number(weekdayRaw);
  const daypart = daypartFor(Number(hourRaw));

  if (box.total === 0) return pick(weighted(EMPTY_BOX, 1), seed);

  const candidates: Line[] = [
    ...weighted(BY_DAYPART[daypart], 1),
    ...boxLines(box, daypart, weekday),
  ];

  if (weekday === SATURDAY) {
    // Saturday overrides rather than adds. A "what's for dinner" prompt is
    // the wrong question today, so the daypart pool sits this one out.
    candidates.length = 0;
    candidates.push(...weighted(SHABBAT, 1));
  } else if (weekday === FRIDAY) {
    if (daypart === "morning") candidates.push(...weighted(FRIDAY_MORNING, 2));
    else if (daypart === "midday" || daypart === "afternoon" || daypart === "evening") {
      candidates.push(...weighted(EREV_SHABBAT, 3));
    }
  }

  return pick(candidates, seed);
}

const weighted = (texts: string[], weight: number): Line[] =>
  texts.map((text) => ({ text, weight }));

function pick(candidates: Line[], seed: number): string {
  const total = candidates.reduce((sum, c) => sum + c.weight, 0);
  let x = seed * total;
  for (const c of candidates) {
    x -= c.weight;
    if (x < 0) return c.text;
  }
  return candidates[candidates.length - 1].text;
}
