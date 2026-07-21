// One-off (re-runnable) backfill: applies the step-kind heuristic to every
// existing step row. New recipes get classified automatically at parse time
// (see src/lib/parser/stepKind.ts) — this script exists for recipes saved
// before the "kind" column existed, or to re-run after the heuristic itself
// is improved. Safe to run repeatedly; it only touches the `kind` column.
//
// Usage: node scripts/reclassify-steps.mjs
//
// NOTE: keep this heuristic in sync with src/lib/parser/stepKind.ts by hand —
// this script is plain JS (no ts-node in this project) so it can't import
// the .ts module directly.

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const CTA_PATTERN =
  /(לחצו כאן|קראו עוד|קרא עוד|מתכון כאן|לעוד מתכונים|עקבו אחר(י|ינו)?|הירשמו|תסגרו פינה|קישור בביו|click here|read more|link in bio|follow me|subscribe|check out my|more recipes)/i;

const TIP_PATTERN =
  /(אפשר להכין|ניתן להכין|אפשר גם|אפשר לשמור|מומלץ להגיש|לשרת עם|טיפ\s*:|עצה\s*:|אם רוצים|you can also|leftover|tip\s*:|note\s*:|optional\s*:|if desired|store in an? airtight)/i;

const COOKING_VERB =
  /(מחמם|מוזג|מערבב|טורפ|אופ|מניח|מוציא|מעביר|מפזר|משחימ|מגיש|קוצצ|מטגנ|מבשל|מקציפ|מקרר|מוסיפ|מכניס|חותכ|מסנן|preheat|pour|whisk|bake|place|remove|transfer|sprinkle|serve|chop|fry|cook|whip|chill|add|combine|stir|mix|heat|simmer|blend|knead)/i;

function classifyStepKind(text) {
  const trimmed = text.trim();
  if (CTA_PATTERN.test(trimmed)) return "ignored";
  if (TIP_PATTERN.test(trimmed)) return "tip";
  if (trimmed.length > 200 && !COOKING_VERB.test(trimmed)) return "ignored";
  return "instruction";
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: steps, error } = await admin.from("step").select("id,text,kind");
if (error) {
  console.error("Failed to fetch steps:", error.message);
  process.exit(1);
}

let changed = 0;
for (const step of steps) {
  const kind = classifyStepKind(step.text);
  if (kind !== step.kind) {
    const { error: updateErr } = await admin.from("step").update({ kind }).eq("id", step.id);
    if (updateErr) {
      console.error(`Failed to update step ${step.id}:`, updateErr.message);
      continue;
    }
    changed++;
    console.log(`${step.kind} -> ${kind}: ${step.text.slice(0, 60)}`);
  }
}

console.log(`Done. ${changed}/${steps.length} step(s) reclassified.`);
