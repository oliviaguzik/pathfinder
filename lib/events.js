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

export function eventFormFromEvent(event) {
  return {
    title: event.title,
    date: event.date,
    allDay: !!event.all_day,
    startTime: (event.start_time || "09:00").slice(0, 5),
    endTime: (event.end_time || "").slice(0, 5),
    location: event.location || "",
    notes: event.notes || "",
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
  return {
    fields: {
      title: form.title.trim(),
      date: form.date,
      all_day: form.allDay,
      start_time: form.allDay ? null : form.startTime,
      end_time: form.allDay || !form.endTime ? null : form.endTime,
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
    },
  };
}
