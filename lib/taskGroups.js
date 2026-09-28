import { daysFromToday, getWeekDays, localDateOf, toISODateLocal } from "./dates";

export const DUE_GROUPS = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "noDate", label: "No date" },
];

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
