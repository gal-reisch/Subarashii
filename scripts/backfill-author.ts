// One-off backfill for the `author` column added in migration 0006.
//
// Recipes imported before the source-name fallback landed have a null author,
// so the line under the title on their cards is blank even though the source
// page names someone perfectly well. This re-reads each recipe's source page
// and applies the exact same derivation the live importer now uses:
//
//   schema.org author → schema.org publisher → og:site_name → the social
//   account that posted it → the hostname
//
// Only rows whose author is currently null are touched, and only when a name
// is actually found — nothing is ever overwritten or cleared. Manual recipes
// (no source_url) are skipped, since there is no source to name.
//
// Run with:  npx tsx --env-file=.env.local scripts/backfill-author.ts [--write]
// Without --write it prints what it would do and changes nothing.

import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";
import { extractRecipeFromHtml } from "../src/lib/parser/jsonld";
import { deriveSourceName } from "../src/lib/parser/sourceName";

const WRITE = process.argv.includes("--write");

// Same crawler-ish UA the importer uses; social hosts serve a login wall to
// anything that looks like a plain script.
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/122.0 Safari/537.36";

async function nameFor(url: string): Promise<string | null> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
    },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const $ = cheerio.load(html);

  const jr = extractRecipeFromHtml(html);
  return (
    jr?.author ??
    jr?.publisher ??
    deriveSourceName({
      siteName: $('meta[property="og:site_name"]').attr("content"),
      ogTitle: $('meta[property="og:title"]').attr("content"),
      url,
    })
  );
}

async function main() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await db
    .from("recipe")
    .select("id,title,author,source_url")
    .is("author", null);
  if (error) throw new Error(error.message);

  console.log(`${data.length} recipe(s) with no author\n`);

  for (const r of data) {
    if (!r.source_url) {
      console.log(`skip   ${r.title} — no source url`);
      continue;
    }
    let name: string | null = null;
    try {
      name = await nameFor(r.source_url);
    } catch (e) {
      console.log(`fail   ${r.title} — ${(e as Error).message}`);
      continue;
    }
    if (!name) {
      console.log(`none   ${r.title} — source names nobody`);
      continue;
    }
    if (WRITE) {
      const { error: upErr } = await db
        .from("recipe")
        .update({ author: name })
        .eq("id", r.id);
      console.log(upErr ? `ERR    ${r.title} — ${upErr.message}` : `set    ${r.title} → ${name}`);
    } else {
      console.log(`would  ${r.title} → ${name}`);
    }
  }

  if (!WRITE) console.log("\nDry run. Re-run with --write to apply.");
}

main();
