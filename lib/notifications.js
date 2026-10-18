import { occurrencesBetween } from "./events";

// Decides which notifications are due right now for one person. Pure (no
// database, no sending), so it can be tested; the send route
// (app/api/notifications/send) loads the data and does the sending.
//
// settings: { event_lead_minutes, morning_summary_time, overdue_nudge_time }
//   (null = off; times are "HH:MM[:SS]" in the person's own time zone)
// events: their events (repeating ones expanded here); an event's
//   `reminder_minutes` overrides the lead (null = use the default, -1 = none)
// tasks: their tasks; `remind_at` is an exact moment (timestamp)
// sent: Set of "kind:ref" already sent, so nothing goes out twice
//
// Returns [{ kind, ref, title, body, url }].

// How late a notification may still go out if a check was missed.
const EVENT_WINDOW_MS = 10 * 60000;
const DAILY_WINDOW_MS = 3 * 60 * 60000;
const TASK_WINDOW_MS = 60 * 60000;

const pad = (n) => String(n).padStart(2, "0");

// The wall-clock date and time in `timeZone` at `now`, and that wall-clock
// moment as a number we can compare event times with.
export function localNow(now, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}`;
  return { date, time, ms: wallMs(date, time) };
}

// "2026-10-17" + "17:00" -> a number for comparing wall-clock moments.
export function wallMs(date, time) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return Date.UTC(y, m - 1, d, h, mi);
}

function addDays(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

// "5:00 PM"
function clock(time) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
}

// 15 -> "15 min", 60 -> "1 hour", 1440 -> "1 day"
export function leadLabel(minutes) {
  if (minutes % 1440 === 0) return minutes === 1440 ? "1 day" : `${minutes / 1440} days`;
  if (minutes % 60 === 0) return minutes === 60 ? "1 hour" : `${minutes / 60} hours`;
  return `${minutes} min`;
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

// Inside a daily notification's window (from its time, for a few hours)?
function dailyDue(local, time) {
  if (!time) return false;
  const at = wallMs(local.date, time.slice(0, 5));
  return local.ms >= at && local.ms < at + DAILY_WINDOW_MS;
}

export function dueNotifications({ now, timeZone, settings, events, tasks, sent }) {
  const local = localNow(now, timeZone);
  const today = local.date;
  const out = [];
  const add = (n) => {
    if (!sent.has(`${n.kind}:${n.ref}`)) out.push(n);
  };

  // Before events (repeats included; all-day events are left to the summary).
  // Tomorrow is checked too, for long leads and reminders just after midnight.
  for (const ev of occurrencesBetween(events, today, addDays(today, 1))) {
    if (ev.all_day || !ev.start_time) continue;
    const lead = ev.reminder_minutes ?? settings.event_lead_minutes;
    if (lead === null || lead === undefined || lead < 0) continue;
    const fireAt = wallMs(ev.date, ev.start_time.slice(0, 5)) - lead * 60000;
    if (local.ms < fireAt || local.ms >= fireAt + EVENT_WINDOW_MS) continue;
    const when = clock(ev.start_time);
    add({
      kind: "event",
      ref: `${ev.id}:${ev.date}`,
      title: ev.title,
      body: [lead === 0 ? `Starting now · ${when}` : `In ${leadLabel(lead)} · ${when}`, ev.location].filter(Boolean).join(" · "),
      url: "/",
    });
  }

  const open = tasks.filter((t) => t.status !== "Done");
  const overdue = open.filter((t) => t.due_date && t.due_date < today).length;

  // Morning summary (only when there's something to say).
  if (dailyDue(local, settings.morning_summary_time)) {
    const eventCount = occurrencesBetween(events, today, today).length;
    const dueToday = open.filter((t) => t.due_date === today).length;
    const parts = [
      eventCount && plural(eventCount, "event"),
      dueToday && `${plural(dueToday, "task")} due`,
      overdue && `${overdue} overdue`,
    ].filter(Boolean);
    if (parts.length) add({ kind: "summary", ref: today, title: "Your day", body: parts.join(" · "), url: "/" });
  }

  // Evening nudge about overdue tasks.
  if (overdue && dailyDue(local, settings.overdue_nudge_time)) {
    add({
      kind: "overdue",
      ref: today,
      title: "Overdue tasks",
      body: `${plural(overdue, "task")} ${overdue === 1 ? "is" : "are"} overdue. Give ${overdue === 1 ? "it" : "them"} a new date?`,
      url: "/plan",
    });
  }

  // Task reminders at an exact moment.
  for (const t of open) {
    if (!t.remind_at) continue;
    const at = Date.parse(t.remind_at);
    if (now.getTime() < at || now.getTime() >= at + TASK_WINDOW_MS) continue;
    add({ kind: "task", ref: `${t.id}:${t.remind_at}`, title: "Reminder", body: t.name, url: "/plan" });
  }

  return out;
}
