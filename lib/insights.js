import { daysFromToday, localDateOf } from "./dates";
import { isGoalFullyDone } from "./goalCompletion";

const STALE_DAYS = 7;

// Active goals that deserve a nudge, most pressing first:
// past their target date, ready to finish, missing a next step, or with no
// task completed in the last week.
export function goalsNeedingAttention(goals, tasks, now = new Date()) {
  const result = [];
  for (const goal of goals) {
    if (goal.completed_at) continue;
    const goalTasks = tasks.filter((t) => t.goal_id === goal.id);
    const openCount = goalTasks.filter((t) => t.status !== "Done").length;
    const pastTarget = goal.target_date && daysFromToday(goal.target_date, now) < 0;
    const lastDone = goalTasks
      .map((t) => t.completed_at)
      .filter(Boolean)
      .sort()
      .pop();
    const since = lastDone || goal.created_at;
    const idleDays = since ? -daysFromToday(localDateOf(since), now) : 0;

    if (pastTarget && openCount > 0) {
      result.push({ goal, kind: "overdue", text: "Past its target date" });
    } else if (isGoalFullyDone(goalTasks)) {
      result.push({ goal, kind: "ready", text: "All tasks done — ready to finish" });
    } else if (openCount === 0) {
      result.push({ goal, kind: "no-next-step", text: "No next step — add a task" });
    } else if (idleDays >= STALE_DAYS) {
      result.push({ goal, kind: "stale", text: `No progress in ${idleDays} days` });
    }
  }
  const order = { overdue: 0, "no-next-step": 1, stale: 2, ready: 3 };
  return result.sort((a, b) => order[a.kind] - order[b.kind]);
}

const DAY_MS = 86400000;

function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

// The review period ("week" | "month" | "year") containing `anchor`, split into
// chart buckets: days for a week or month, months for a year. `end` is exclusive.
export function getPeriod(range, anchor) {
  if (range === "year") {
    const start = new Date(anchor.getFullYear(), 0, 1);
    const buckets = Array.from({ length: 12 }, (_, m) => {
      const b = new Date(anchor.getFullYear(), m, 1);
      return {
        start: b,
        end: new Date(anchor.getFullYear(), m + 1, 1),
        label: b.toLocaleDateString(undefined, { month: "short" }),
        longLabel: b.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
      };
    });
    return { range, start, end: new Date(anchor.getFullYear() + 1, 0, 1), buckets };
  }
  const start =
    range === "month"
      ? new Date(anchor.getFullYear(), anchor.getMonth(), 1)
      : addDays(anchor, -anchor.getDay());
  const end = range === "month" ? new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1) : addDays(start, 7);
  const days = Math.round((end - start) / DAY_MS);
  const buckets = Array.from({ length: days }, (_, i) => {
    const b = addDays(start, i);
    return {
      start: b,
      end: addDays(b, 1),
      label:
        range === "month"
          ? String(b.getDate())
          : b.toLocaleDateString(undefined, { weekday: "short" }),
      longLabel: b.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }),
    };
  });
  return { range, start, end, buckets };
}

// The same kind of period, `steps` periods before (negative) or after `anchor`.
export function shiftAnchor(range, anchor, steps) {
  if (range === "year") return new Date(anchor.getFullYear() + steps, 0, 1);
  if (range === "month") return new Date(anchor.getFullYear(), anchor.getMonth() + steps, 1);
  return addDays(anchor, 7 * steps);
}

// What got done in a period: completed tasks (newest first), counts per
// bucket, and goals finished.
export function periodReport(tasks, goals, period) {
  const within = (timestamp, from, to) => {
    if (!timestamp) return false;
    const t = new Date(timestamp);
    return t >= from && t < to;
  };
  const completed = tasks
    .filter((t) => t.status === "Done" && within(t.completed_at, period.start, period.end))
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at));
  const perBucket = period.buckets.map((b) => ({
    ...b,
    count: completed.filter((t) => within(t.completed_at, b.start, b.end)).length,
  }));
  const goalsFinished = goals.filter((g) => within(g.completed_at, period.start, period.end));
  return { completed, perBucket, goalsFinished };
}
