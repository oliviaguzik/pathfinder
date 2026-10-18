import "server-only";
import { createClient } from "@supabase/supabase-js";

// Supabase with the private service key, which can read every person's rows.
// Server only: "server-only" above makes the build fail if this file is ever
// pulled into code that runs in a browser. The key lives in Vercel's (and
// .env.local's) secret settings, never in the app's code.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
