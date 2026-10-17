import { daysFromToday, getWeekDays, localDateOf, parseLocalDate, toISODateLocal } from "./dates";
import { sortEvents } from "./events";

// Splits an already-sorted task list into due-date groups plus "completed",
// keeping the incoming order within each group.
export function groupTasksByDue(tasks, now = new Date()) {
  const groups = { overdue: [], today: [], upcoming: [], noDate: [], completed: [] };
  for (const task of tasks) {
    if (task.status === "Done") {
      groups.completed.push(task);
    } else if (!task.due_date) {
      groups.noDate.push(task);
    } else {
      const diff = daysFromToday(task.due_date, now);
      groups[diff < 0 ? "overdue" : diff === 0 ? "today" : "upcoming"].push(task);
    }
  }
  return groups;
}

// Completed tasks, newest first, grouped by when they were finished:
// Today, Yesterday, Earlier this week, Older. Tasks finished before completion
// times were recorded have no date and go last, in "Older".
export function groupCompleted(tasks, now = new Date()) {
  const today = toISODateLocal(now);
  const yesterday = toISODateLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const weekStart = toISODateLocal(getWeekDays(now)[0]);
  const sorted = [...tasks].sort((a, b) => {
    if (a.completed_at && b.completed_at) return b.completed_at.localeCompare(a.completed_at);
    if (a.completed_at) return -1;
    if (b.completed_at) return 1;
    return (b.created_at || "").localeCompare(a.created_at || "");
  });
  const groups = [
    { key: "today", label: "Today", tasks: [] },
    { key: "yesterday", label: "Yesterday", tasks: [] },
    { key: "week", label: "Earlier this week", tasks: [] },
    { key: "older", label: "Older", tasks: [] },
  ];
  const byKey = Object.fromEntries(groups.map((g) => [g.key, g]));
  for (const task of sorted) {
    const day = task.completed_at ? localDateOf(task.completed_at) : null;
    if (day === today) byKey.today.tasks.push(task);
    else if (day === yesterday) byKey.yesterday.tasks.push(task);
    else if (day && day >= weekStart) byKey.week.tasks.push(task);
    else byKey.older.tasks.push(task);
  }
  return groups;
}

// Events reach this far ahead in the Plan page's agenda, so a busy future
// doesn't bury today's tasks.
export const EVENT_LOOKAHEAD_DAYS = 14;

// "Today", "Tomorrow", else "Mon, Oct 19" (with the year only when it isn't this year).
export function agendaDayLabel(dateStr, now = new Date()) {
  const diff = daysFromToday(dateStr, now);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  const date = parseLocalDate(dateStr);
  const options = { weekday: "short", month: "short", day: "numeric" };
  if (date.getFullYear() !== now.getFullYear()) options.year = "numeric";
  return date.toLocaleDateString(undefined, options);
}

// The calendar's side panel: overdue tasks first, then each day that has
// something on it, with its events (the next two weeks) before its tasks.
// Finished tasks and past events are left out.
export function buildAgenda(tasks, events, now = new Date()) {
  const overdue = [];
  const days = {};
  const day = (date) => (days[date] ||= { key: date, label: agendaDayLabel(date, now), events: [], tasks: [] });
  for (const task of tasks) {
    if (task.status === "Done" || !task.due_date) continue;
    if (daysFromToday(task.due_date, now) < 0) overdue.push(task);
    else day(task.due_date).tasks.push(task);
  }
  for (const event of sortEvents(events)) {
    const diff = daysFromToday(event.date, now);
    if (diff >= 0 && diff <= EVENT_LOOKAHEAD_DAYS) day(event.date).events.push(event);
  }
  const byDate = (a, b) => a.due_date.localeCompare(b.due_date);
  const sections = Object.values(days).sort((a, b) => a.key.localeCompare(b.key));
  if (overdue.length) sections.unshift({ key: "overdue", label: "Overdue", events: [], tasks: overdue.sort(byDate) });
  return sections;
}


// An open task whose due date has passed / is today.
export function isOverdue(task, now = new Date()) {
  return !!task.due_date && task.status !== "Done" && daysFromToday(task.due_date, now) < 0;
}

export function isDueToday(task, now = new Date()) {
  return !!task.due_date && task.status !== "Done" && daysFromToday(task.due_date, now) === 0;
}
