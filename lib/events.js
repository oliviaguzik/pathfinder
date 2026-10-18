import { presetFromRecurrence, recurrenceFromPreset } from "./recurrence";
import { parseLocalDate, toISODateLocal } from "./dates";

// Events are things that happen at a time (appointments, hangouts…). Times are
// stored as "HH:MM[:SS]" (Postgres `time`) on a local date.

// "15:30:00" -> "3:30 PM" (in the viewer's locale).
export function formatTime(time) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

// "All day", "3:30 PM", or "3:30 PM – 4:30 PM".
export function eventTimeLabel(event) {
  if (event.all_day || !event.start_time) return "All day";
  const start = formatTime(event.start_time);
  return event.end_time ? `${start} – ${formatTime(event.end_time)}` : start;
}

// All-day events first, then by start time.
export function sortEvents(events) {
  return [...events].sort((a, b) => {
    if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
    return (a.start_time || "").localeCompare(b.start_time || "");
  });
}

export const EMPTY_EVENT_FORM = {
  title: "",
  date: "",
  allDay: false,
  startTime: "09:00",
  endTime: "10:00",
  location: "",
  notes: "",
  repeats: false,
  recurrencePreset: "weekly",
  recurrenceCustomDays: "2",
  repeatUntil: "",
  reminderMinutes: "", // "" = your default, "-1" = none, else minutes before
};

// A fresh form for a new event: today (or `date`), starting at the next full
// hour and lasting an hour.
export function newEventForm(date, now = new Date()) {
  const startHour = Math.min(now.getHours() + 1, 23);
  const pad = (n) => String(n).padStart(2, "0");
  return {
    ...EMPTY_EVENT_FORM,
    date: date || `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    startTime: `${pad(startHour)}:00`,
    endTime: startHour < 23 ? `${pad(startHour + 1)}:00` : "",
  };
}

// For a repeat shown on a later day, the form edits the whole series, so it
// starts from the series' first date.
export function eventFormFromEvent(event) {
  const repeats = !!event.recurrence_unit;
  return {
    title: event.title,
    date: event.seriesDate || event.date,
    allDay: !!event.all_day,
    startTime: (event.start_time || "09:00").slice(0, 5),
    endTime: (event.end_time || "").slice(0, 5),
    location: event.location || "",
    notes: event.notes || "",
    repeats,
    wasRepeating: repeats,
    recurrencePreset: repeats ? presetFromRecurrence(event.recurrence_unit, event.recurrence_interval || 1) : "weekly",
    recurrenceCustomDays: String(event.recurrence_interval || 2),
    repeatUntil: event.repeat_until || "",
    reminderMinutes: event.reminder_minutes === null || event.reminder_minutes === undefined ? "" : String(event.reminder_minutes),
    hadReminder: event.reminder_minutes !== null && event.reminder_minutes !== undefined,
  };
}

// Returns { fields } ready to save, or { error } explaining what to fix.
export function eventFieldsFromForm(form) {
  if (!form.title.trim()) return { error: "Give the event a name first." };
  if (!form.date) return { error: "Pick a date for the event." };
  if (!form.allDay && !form.startTime) return { error: "Add a start time, or make it an all-day event." };
  if (!form.allDay && form.endTime && form.endTime <= form.startTime) {
    return { error: "The end time needs to be after the start time." };
  }
  if (form.repeats && form.repeatUntil && form.repeatUntil < form.date) {
    return { error: "“Until” needs to be on or after the event's date." };
  }
  return {
    fields: {
      title: form.title.trim(),
      date: form.date,
      all_day: form.allDay,
      start_time: form.allDay ? null : form.startTime,
      end_time: form.allDay || !form.endTime ? null : form.endTime,
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
      // Repeat columns are only sent for repeating events (or to stop one
      // repeating), so one-off events save even before the repeat migration.
      ...((form.repeats || form.wasRepeating) && repeatFields(form)),
      // Likewise, an event's own reminder is only sent when one is (or was) chosen.
      ...((form.reminderMinutes !== "" || form.hadReminder) && {
        reminder_minutes: form.reminderMinutes === "" ? null : Number(form.reminderMinutes),
      }),
    },
  };
}

function repeatFields(form) {
  if (!form.repeats) return { recurrence_unit: null, recurrence_interval: 1, repeat_until: null };
  const { unit, interval } = recurrenceFromPreset(form.recurrencePreset, form.recurrenceCustomDays);
  return { recurrence_unit: unit, recurrence_interval: interval, repeat_until: form.repeatUntil || null };
}

// "Every week", "Every 2 days", "Every month".
export function repeatLabel(event) {
  const n = event.recurrence_interval || 1;
  return n === 1 ? `Every ${event.recurrence_unit}` : `Every ${n} ${event.recurrence_unit}s`;
}

// Every event happening between `from` and `to` (YYYY-MM-DD, inclusive), with
// repeating events expanded into one entry per day they happen. A repeat keeps
// its event's id, gets the day as `date`, and remembers the series' first
// date as `seriesDate`. Monthly repeats skip months without that day (the 31st).
export function occurrencesBetween(events, from, to) {
  const out = [];
  for (const ev of events) {
    if (!ev.recurrence_unit) {
      if (ev.date >= from && ev.date <= to) out.push(ev);
      continue;
    }
    const last = ev.repeat_until && ev.repeat_until < to ? ev.repeat_until : to;
    const skipped = new Set(ev.skip_dates || []);
    const start = parseLocalDate(ev.date);
    const n = ev.recurrence_interval || 1;
    for (let i = 0; i < 2000; i++) {
      let day;
      if (ev.recurrence_unit === "month") {
        const d = new Date(start.getFullYear(), start.getMonth() + i * n, start.getDate());
        if (d.getDate() !== start.getDate()) continue;
        day = toISODateLocal(d);
      } else {
        const step = ev.recurrence_unit === "week" ? 7 * n : n;
        // Jump straight to the first repeat on or after `from`.
        if (i === 0 && ev.date < from) {
          const gap = Math.round((parseLocalDate(from) - start) / 86400000);
          i = Math.ceil(gap / step);
        }
        day = toISODateLocal(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i * step));
      }
      if (day > last) break;
      if (day >= from && !skipped.has(day)) out.push(day === ev.date ? { ...ev, seriesDate: ev.date } : { ...ev, date: day, seriesDate: ev.date });
    }
  }
  return out;
}
