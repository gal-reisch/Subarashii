import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY client using the service role key. Bypasses Row Level Security.
// Only use in trusted server contexts (e.g. the token-authenticated ingest
// endpoint), never in code reachable by the browser.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
