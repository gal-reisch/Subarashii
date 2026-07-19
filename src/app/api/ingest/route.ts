import { NextResponse, type NextRequest } from "next/server";
import { parseInput } from "@/lib/parser";
import { rateLimit } from "@/lib/rateLimit";
import { getHouseholdId, saveParsedRecipe } from "@/lib/recipes";
import { createServiceClient } from "@/lib/supabase/service";

// Ingest endpoint for the iOS "Save to Subarashii" Shortcut.
// Auth: a static bearer token (INGEST_TOKEN) — the phone has no user session.
export async function POST(req: NextRequest) {
  const token = process.env.INGEST_TOKEN;
  const auth = req.headers.get("authorization") ?? "";
  if (!token || auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`ingest:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: { type?: string; url?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const parsed = await parseInput({ url: body.url, text: body.text });

  const supabase = createServiceClient();
  const householdId = await getHouseholdId(supabase);
  if (!householdId) {
    return NextResponse.json({ error: "no_household" }, { status: 500 });
  }

  try {
    const { id } = await saveParsedRecipe(supabase, householdId, parsed, null);
    return NextResponse.json({
      ok: true,
      id,
      title: parsed.title,
      needsReview: parsed.needs_review,
    });
  } catch {
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
