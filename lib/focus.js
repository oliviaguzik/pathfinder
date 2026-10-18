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

// Suggestions for the focus picker, best first, each task once:
// the main goal's next step, overdue, due today, then high priority.
// Everything else open is in `rest` (for searching). Tasks already in today's
// focus, and tasks of paused goals, are left out.
export function focusCandidates(tasks, { today, nextStepId = null, pausedGoalIds = new Set() }) {
  const open = tasks.filter((t) => isOpen(t) && t.focus_date !== today && !pausedGoalIds.has(t.goal_id));
  const used = new Set();
  const take = (title, list) => {
    const fresh = list.filter((t) => !used.has(t.id));
    fresh.forEach((t) => used.add(t.id));
    return fresh.length ? [{ title, tasks: fresh }] : [];
  };
  const byDue = (a, b) => (a.due_date || "").localeCompare(b.due_date || "");
  const sections = [
    ...take("Next step for your main goal", open.filter((t) => t.id === nextStepId)),
    ...take("Overdue", open.filter((t) => t.due_date && t.due_date < today).sort(byDue)),
    ...take("Due today", open.filter((t) => t.due_date === today)),
    ...take("High priority", open.filter((t) => t.priority === "High").sort(byDue)),
  ];
  const rest = open
    .filter((t) => !used.has(t.id))
    .sort((a, b) => (a.due_date ? (b.due_date ? byDue(a, b) : -1) : b.due_date ? 1 : (a.name || "").localeCompare(b.name || "")));
  return { sections, rest };
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
