export function isGoalFullyDone(goalTasks) {
  return goalTasks.length > 0 && goalTasks.every((t) => t.status === "Done");
}

// Finishing a goal is always an explicit action (the "Finish goal" button) —
// reaching 100% just unlocks that button rather than auto-completing.
// Un-finishing, though, happens automatically: if a previously finished goal
// gets a task un-checked, it's no longer actually done, so revert it.
export function computeGoalUncompletionPatch(goal, goalTasksAfterChange) {
  if (!goal || !goal.completed_at) return null;
  if (isGoalFullyDone(goalTasksAfterChange)) return null;
  return { completed_at: null, status: "In Progress" };
}
