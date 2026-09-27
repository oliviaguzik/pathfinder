import { supabase } from "./supabaseClient";

export function isGoalFullyDone(goalTasks) {
  return goalTasks.length > 0 && goalTasks.every((t) => t.status === "Done");
}

// The saved status mirrors what the goal card shows: Completed once finished,
// In Progress once any linked task is done, otherwise Not Started.
export function goalStatusFor(goal, goalTasks) {
  if (goal.completed_at) return "Completed";
  return goalTasks.some((t) => t.status === "Done") ? "In Progress" : "Not Started";
}

// Finishing a goal is always an explicit action (the "Finish goal" button) —
// reaching 100% just unlocks that button rather than auto-completing.
// Un-finishing, though, happens automatically: if a previously finished goal
// gets an unchecked task, it's no longer actually done, so revert it.
export function computeGoalUncompletionPatch(goal, goalTasksAfterChange) {
  if (!goal || !goal.completed_at) return null;
  if (!goalTasksAfterChange.some((t) => t.status !== "Done")) return null;
  return { completed_at: null, status: goalStatusFor({ ...goal, completed_at: null }, goalTasksAfterChange) };
}

export function computeGoalStatusPatch(goal, goalTasksAfterChange) {
  if (!goal) return null;
  const status = goalStatusFor(goal, goalTasksAfterChange);
  return status === goal.status ? null : { status };
}

// Saves any of the given goals whose status no longer matches its tasks.
// `tasksAfterChange` is the full task list as it stands after the change.
export async function syncGoalStatuses(goalIds, goals, tasksAfterChange) {
  for (const goalId of new Set(goalIds)) {
    if (!goalId) continue;
    const goal = goals.find((g) => g.id === goalId);
    const goalTasks = tasksAfterChange.filter((t) => t.goal_id === goalId);
    const patch =
      computeGoalUncompletionPatch(goal, goalTasks) || computeGoalStatusPatch(goal, goalTasks);
    if (patch) {
      await supabase.from("goals").update(patch).eq("id", goalId);
    }
  }
}
