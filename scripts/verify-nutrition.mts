// One-off verification script (not part of the app) — calls the real
// matchIngredientNutrition pipeline directly against a handful of test
// lines and prints what each one resolved to, so we can confirm the
// USDA/Tzameret/Gemini routing and the new relevance guard without fighting
// flaky browser automation. Run with: npx tsx scripts/verify-nutrition.mts
import { readFileSync } from "node:fs";

// Tiny inline .env parser — avoids adding a dotenv dependency just for this
// one-off script.
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) process.env[m[1]] = m[2];
}

const { matchIngredientNutrition } = await import("../src/lib/nutrition/match");

const cases: Array<{ text: string; lang: "en" | "he" }> = [
  { text: "2 cups flour", lang: "en" },
  { text: "1 egg", lang: "en" },
  { text: "200g sugar", lang: "en" },
  { text: "כוס קמח", lang: "he" },
  { text: "1 pinch of dragon whiskers", lang: "en" },
];

for (const c of cases) {
  const result = await matchIngredientNutrition(c.text, c.lang);
  console.log(`\n"${c.text}" (${c.lang})`);
  console.log(JSON.stringify(result, null, 2));
}
