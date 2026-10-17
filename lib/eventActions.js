import { supabase } from "./supabaseClient";

// Puts a deleted event back exactly as it was (same id and fields).
export async function restoreEvent(event) {
  await supabase.from("events").insert(event);
}

export async function deleteEvent(event) {
  await supabase.from("events").delete().eq("id", event.id);
}
