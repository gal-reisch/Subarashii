import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// DEV-ONLY sign-in shortcut. Mints a real Supabase session for the app's
// owner account without an email round-trip, so local `next dev` previews
// (screenshots, preview_eval, etc.) can reach authenticated screens without
// clicking a magic link every time the session gets cleared.
//
// Hard-gated to development: this always 404s once NODE_ENV is
// "production" (true for every `next build`/Vercel deploy), so it never
// becomes reachable on the live site — even though the route file itself
// ships in the build. Do not weaken or remove this check.
const DEV_LOGIN_EMAIL = "zerobygal@gmail.com";

export async function GET(req: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("Not found", { status: 404 });
  }

  const email = new URL(req.url).searchParams.get("email") ?? DEV_LOGIN_EMAIL;

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error || !data.properties?.hashed_token) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to generate a dev session" },
      { status: 500 },
    );
  }

  // Verify the token against the request-bound (cookie-writing) client so
  // the resulting session is set as real cookies — identical to what
  // /auth/callback does for a normal magic-link click.
  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.properties.hashed_token,
  });
  if (verifyError) {
    return NextResponse.json({ error: verifyError.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL("/", req.url));
}
