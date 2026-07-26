// Rotating headline for the home page.
//
// This started as deadpan Vine-style one-liners. The user's read was that the
// jokes weren't landing ("every recipe is a suggestion until you own a fire
// extinguisher" was the example) and asked for a call to action instead —
// "very eye-level and chill".
//
// So the register here is: a friend leaning on the counter asking what you
// feel like, not an app trying to drive engagement. Rules for additions:
//   - Short. One line, no wrap on a phone.
//   - Ask or invite; don't instruct and don't exclaim.
//   - No marketing verbs ("Discover", "Explore", "Unlock"), no emoji, no
//     exclamation marks.
//   - A little warmth is fine. A punchline is not the goal anymore.
//
// A different one shows on every entry to the app. See `src/app/page.tsx` —
// the page opts into `force-dynamic` specifically so this re-rolls per
// request instead of being frozen into a prerendered shell at build time.
export const HOME_PROMPTS: string[] = [
  "What are we making?",
  "What sounds good?",
  "Pick something.",
  "What are you in the mood for?",
  "Let's find you dinner.",
  "Something easy tonight?",
  "What's for dinner?",
  "Start somewhere.",
  "Anything catching your eye?",
  "Feel like cooking?",
  "What are we having?",
  "Something quick, or something slow?",
  "Have a look.",
  "What'll it be?",
  "Pick one and go.",
  "Feeding anyone tonight?",
  "Where are we starting?",
  "Something familiar, or something new?",
  "Take your pick.",
  "What're you hungry for?",
  "Let's get something going.",
  "Anything you've been meaning to make?",
  "Choose your own adventure.",
  "What's the plan?",
  "Time to make something.",
];

export function randomPrompt(): string {
  return HOME_PROMPTS[Math.floor(Math.random() * HOME_PROMPTS.length)];
}
