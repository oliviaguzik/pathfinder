import { createClient } from "@supabase/supabase-js";
import { notifyError } from "./notify";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Pages don't check the result of every save, so a rejected write used to fail
// silently. Surface any failed database request (reads included) as a toast.
async function fetchWithErrors(input, init) {
  let response;
  try {
    response = await fetch(input, init);
  } catch (err) {
    notifyError(
      typeof navigator !== "undefined" && !navigator.onLine
        ? "You're offline. Changes won't save until you reconnect."
        : "Couldn't reach the database. Check your connection and try again."
    );
    throw err;
  }
  const url = typeof input === "string" ? input : input.url;
  if (!response.ok && url.includes("/rest/v1/")) {
    let detail = {};
    try {
      detail = await response.clone().json();
    } catch {}
    const action = (init?.method || "GET") === "GET" ? "load your data" : "save your change";
    notifyError(
      ["PGRST204", "PGRST205", "42703", "42P01"].includes(detail.code)
        ? `Couldn't ${action}: the database is missing a column or table this version of the app needs. Run the newest file in migrations/ in Supabase.`
        : `Couldn't ${action}${detail.message ? `: ${detail.message}` : ""}. Please try again.`
    );
  }
  return response;
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { fetch: fetchWithErrors },
});
