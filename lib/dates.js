// Date-only strings (YYYY-MM-DD) parse as UTC midnight by default, which drifts
// to the wrong local calendar day near midnight. Anchor them to local midnight instead.
export function parseLocalDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

export function toISODateLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function todayLocalISODate() {
  return toISODateLocal(new Date());
}

// Whole calendar days from today to a YYYY-MM-DD date (negative = past).
export function daysFromToday(dateStr, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((parseLocalDate(dateStr) - today) / 86400000);
}

// "Today", "Tomorrow", "Yesterday", a weekday within the next week, else "Oct 19"
// (with the year only when it isn't this year).
export function friendlyDate(dateStr, now = new Date()) {
  const diff = daysFromToday(dateStr, now);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const date = parseLocalDate(dateStr);
  if (diff > 1 && diff < 7) return date.toLocaleDateString(undefined, { weekday: "long" });
  const options = { month: "short", day: "numeric" };
  if (date.getFullYear() !== now.getFullYear()) options.year = "numeric";
  return date.toLocaleDateString(undefined, options);
}

// The Sunday-to-Saturday week containing `date`.
export function getWeekDays(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

// "Oct 18 – 24, 2026", "Sep 27 – Oct 3, 2026", "Dec 27, 2026 – Jan 2, 2027"
export function weekLabel(days) {
  const first = days[0];
  const last = days[6];
  const sameYear = first.getFullYear() === last.getFullYear();
  const start = first.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(!sameYear && { year: "numeric" }) });
  const end =
    first.getMonth() === last.getMonth()
      ? `${last.getDate()}, ${last.getFullYear()}`
      : last.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  return `${start} – ${end}`;
}

// The local calendar date (YYYY-MM-DD) of a timestamp such as completed_at.
export function localDateOf(timestamp) {
  return toISODateLocal(new Date(timestamp));
}

// Quick picks for rescheduling: today, tomorrow and next Monday (YYYY-MM-DD).
export function quickDates(now = new Date()) {
  const day = (offset) => toISODateLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));
  const toMonday = ((8 - now.getDay()) % 7) || 7;
  return { today: day(0), tomorrow: day(1), nextWeek: day(toMonday) };
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// The days shown for a month: whole Sunday-to-Saturday weeks, with the days
// from the neighbouring months marked `outside`.
export function getMonthGrid(year, month) {
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = startWeekday; i > 0; i--) cells.push({ date: new Date(year, month, 1 - i), outside: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d), outside: false });
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), outside: true });
  }
  return cells;
}
