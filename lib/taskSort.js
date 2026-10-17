import { sortByPosition } from "./reorder";

const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };
const EFFORT_RANK = { Small: 0, Medium: 1, Large: 2 };

// sortBy: "due" | "priority" | "effort" | "newest" | "oldest" | "custom".
function sortByCriterion(list, sortBy) {
  if (sortBy === "due") {
    return [...list].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
  }
  if (sortBy === "priority") {
    return [...list].sort((a, b) => (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3));
  }
  if (sortBy === "effort") {
    return [...list].sort((a, b) => (EFFORT_RANK[a.effort] ?? 3) - (EFFORT_RANK[b.effort] ?? 3));
  }
  if (sortBy === "oldest") {
    return [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }
  if (sortBy === "newest") {
    return [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  if (sortBy === "custom") {
    return sortByPosition(list);
  }
  return list;
}

// Completed tasks always sink to the bottom, regardless of the active sort.
export function sortTasksList(list, sortBy) {
  const notDone = list.filter((t) => t.status !== "Done");
  const done = list.filter((t) => t.status === "Done");
  return [...sortByCriterion(notDone, sortBy), ...sortByCriterion(done, sortBy)];
}

export function sortDoneLast(list) {
  return [...list].sort((a, b) => (a.status === "Done") - (b.status === "Done"));
}
