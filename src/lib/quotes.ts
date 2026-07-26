// Rotating headline for the home page, in place of a fixed "Ella's Recipe
// Box" title. The tone brief was explicit: funny, direct, nonsense humour in
// the spirit of Vine — short, confident, non-sequitur, delivered deadpan.
// Keep additions in that register; a wholesome cooking aphorism is the one
// thing that would feel wrong here.
//
// A different one shows on every entry to the app. See `src/app/page.tsx` —
// the page opts into `force-dynamic` specifically so this re-rolls per
// request instead of being frozen into a prerendered shell at build time.
export const COOKING_QUOTES: string[] = [
  "Preheat the oven. Preheat your soul.",
  "It is Wednesday, my dudes. Make soup.",
  "Back at it again with the garlic.",
  "The recipe says 20 minutes. The recipe lies.",
  "Add garlic. That's it. That's the tip.",
  "Season your food. Your ancestors are watching.",
  "Hi, welcome to your kitchen.",
  "Nobody has ever measured a splash. Be brave.",
  "That's not a pinch, that's a whole handshake.",
  "If you can't stand the heat, lower the heat.",
  "Onions don't make you cry. Your technique does.",
  "Rules for cooking: 1. Taste it. There is no 2.",
  "Today's forecast: 100% chance of pasta.",
  "This oven has seen things.",
  "Confidence is the most important spice. Cumin is second.",
  "A watched pot never boils. An unwatched pot boils over. Choose.",
  "The secret ingredient is that I forgot an ingredient.",
  "Don't crowd the pan. The pan has boundaries.",
  "Deglaze. Just deglaze. I don't make the rules.",
  "Every recipe is a suggestion until you own a fire extinguisher.",
  "How do you know when it's done? It'll tell you. It won't. But it will.",
  "Mise en place: French for panicking early so you don't panic later.",
  "Room temperature butter is a lifestyle, not a step.",
  "Low and slow. Like my Wi-Fi.",
  "You've got this. The smoke says otherwise, but you've got this.",
  "Taste as you go, or find out with everyone else.",
  "That's not burnt, that's caramelised. Say it with your chest.",
  "Bay leaf does nothing. Add it anyway. Tradition.",
  "Any pan is a wok if you're brave enough.",
  "Lemon juice fixes it. Whatever it is.",
  "Cooking is just chemistry with snacks.",
  "Yes I doubled the garlic. No I will not be taking questions.",
  "Let it rest. It has been through a lot.",
  "One pot. Zero regrets. Somehow still every dish dirty.",
  "Whisk it. Whisk it real good.",
  "There is no such thing as too much cheese, only insufficient bowl.",
  "Turn the heat down. I'm serious. Down.",
  "Butter is a vegetable if you believe hard enough.",
  "Sharpen your knife, or live dangerously and cry more.",
  "Cook it right once. Then cook it wrong on purpose. That one's yours.",
];

export function randomQuote(): string {
  return COOKING_QUOTES[Math.floor(Math.random() * COOKING_QUOTES.length)];
}
