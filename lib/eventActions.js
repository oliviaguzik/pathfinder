import { supabase } from "./supabaseClient";
import { notifyUndo } from "./notify";
import { agendaDayLabel } from "./taskGroups";

// The stored row behind an event shown on screen (a repeat shown on a later
// day carries `seriesDate`; the row's own date is the series' first date).
export function seriesOf(event) {
  const { seriesDate, ...row } = event;
  return seriesDate ? { ...row, date: seriesDate } : row;
}

// Puts a deleted event back exactly as it was (same id and fields).
export async function restoreEvent(event) {
  await supabase.from("events").insert(seriesOf(event));
}

export async function deleteEvent(event) {
  await supabase.from("events").delete().eq("id", event.id);
}

// Takes one day out of a repeating event ("delete just this one").
export async function skipOccurrence(event) {
  const skip = [...new Set([...(event.skip_dates || []), event.date])];
  await supabase.from("events").update({ skip_dates: skip }).eq("id", event.id);
}

export async function unskipOccurrence(event) {
  const skip = (event.skip_dates || []).filter((d) => d !== event.date);
  await supabase.from("events").update({ skip_dates: skip }).eq("id", event.id);
}

// Deletes an event as shown on screen, with an Undo note: a repeat loses just
// that day unless `wholeSeries`; a one-off event is deleted. `setEvents` /
// `bump` / `reload` let a page show the change at once and refresh after.
export async function removeEventWithUndo(event, { setEvents, bump, reload, wholeSeries = false }) {
  const justOne = !!event.recurrence_unit && !wholeSeries;
  bump();
  if (justOne) {
    setEvents((list) =>
      list.map((e) => (e.id === event.id ? { ...e, skip_dates: [...(e.skip_dates || []), event.date] } : e))
    );
  } else {
    setEvents((list) => list.filter((e) => e.id !== event.id));
  }
  // The note shows right away; Undo waits for the change to finish first.
  const saving = justOne ? skipOccurrence(event) : deleteEvent(event);
  notifyUndo(
    justOne ? `Deleted: ${event.title} (${agendaDayLabel(event.date)})` : `Deleted: ${event.title}`,
    async () => {
      bump();
      if (justOne) {
        setEvents((list) =>
          list.map((e) => (e.id === event.id ? { ...e, skip_dates: (e.skip_dates || []).filter((d) => d !== event.date) } : e))
        );
      } else {
        setEvents((list) => [...list, seriesOf(event)]);
      }
      await saving;
      await (justOne ? unskipOccurrence(event) : restoreEvent(event));
      reload();
    }
  );
  await saving;
  reload();
}
