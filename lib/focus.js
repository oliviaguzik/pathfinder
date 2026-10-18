// Today's focus: up to FOCUS_LIMIT tasks starred for the day
// (`tasks.focus_date` = that day). Pure helpers, so they can be tested; the
// Today page and FocusPicker use them.

export const FOCUS_LIMIT = 3;

// How far back unfinished focus tasks are offered again ("keep them?").
const CARRY_DAYS = 7;

function daysBefore(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d - n));
  return t.toISOString().slice(0, 10);
}

const isOpen = (t) => t.status !== "Done";

// The focus picker's list: every open task, in two groups: those for the main
// goal, then everything else. Most urgent first in each: overdue / sooner due
// dates, high priority before the rest at the same date, undated last (A–Z).
// Tasks already in today's focus, and tasks of paused goals, are left out.
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };

export function byUrgency(a, b) {
  if (a.due_date !== b.due_date) {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  }
  const pa = PRIORITY_RANK[a.priority] ?? 1;
  const pb = PRIORITY_RANK[b.priority] ?? 1;
  return pa - pb || (a.name || "").localeCompare(b.name || "");
}

export function focusCandidates(tasks, { today, mainGoalId = null, pausedGoalIds = new Set() }) {
  const open = tasks.filter((t) => isOpen(t) && t.focus_date !== today && !pausedGoalIds.has(t.goal_id)).sort(byUrgency);
  const forGoal = mainGoalId ? open.filter((t) => t.goal_id === mainGoalId) : [];
  const rest = open.filter((t) => !forGoal.includes(t));
  return { forGoal, rest };
}

// Unfinished tasks from the most recent earlier focus day (within a week), to
// offer keeping today. `letGoThrough` is the last focus day the person
// already said "Let go" to; nothing from that day or before is offered.
export function carryOverFocus(tasks, today, letGoThrough = "") {
  const since = daysBefore(today, CARRY_DAYS);
  const unfinished = tasks.filter(
    (t) => isOpen(t) && t.focus_date && t.focus_date < today && t.focus_date >= since && t.focus_date > letGoThrough
  );
  if (!unfinished.length) return { day: null, tasks: [] };
  const day = unfinished.reduce((latest, t) => (t.focus_date > latest ? t.focus_date : latest), "");
  return { day, tasks: unfinished.filter((t) => t.focus_date === day) };
}
