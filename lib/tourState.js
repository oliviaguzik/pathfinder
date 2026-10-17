import { supabase } from "./supabaseClient";

// Which page tours someone has seen, kept on their account (Supabase user
// metadata, so it follows them to every device; no table needed) and in this
// browser (so it's known instantly, before the account data arrives).
const LOCAL_KEY = "toursSeen";
const RESTART_EVENT = "pathfinder:tour-restart";

function localSeen() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
  } catch {
    return [];
  }
}

export function hasSeenTour(user, id) {
  const fromAccount = user?.user_metadata?.tours_seen || [];
  return fromAccount.includes(id) || localSeen().includes(id);
}

export async function markTourSeen(user, id) {
  const seen = [...new Set([...(user?.user_metadata?.tours_seen || []), ...localSeen(), id])];
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(seen));
  } catch {}
  await supabase.auth.updateUser({ data: { tours_seen: seen } });
}

// "Show the tour again": forget them all, and start this page's tour now.
export async function resetTours() {
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {}
  await supabase.auth.updateUser({ data: { tours_seen: [] } });
  window.dispatchEvent(new Event(RESTART_EVENT));
}

export function onTourRestart(listener) {
  window.addEventListener(RESTART_EVENT, listener);
  return () => window.removeEventListener(RESTART_EVENT, listener);
}
