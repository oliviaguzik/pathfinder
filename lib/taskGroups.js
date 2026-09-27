import { daysFromToday } from "./dates";

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
