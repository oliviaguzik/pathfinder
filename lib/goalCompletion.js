export function isGoalFullyDone(goalTasks) {
  return goalTasks.length > 0 && goalTasks.every((t) => t.status === "Done");
}

// Given a goal and what its linked tasks look like after a status change,
// returns the patch to apply to the goal's completed_at column, or null if unchanged.
export function computeGoalCompletionPatch(goal, goalTasksAfterChange) {
  if (!goal) return null;
  const allDone = isGoalFullyDone(goalTasksAfterChange);
  if (allDone && !goal.completed_at) return { completed_at: new Date().toISOString() };
  if (!allDone && goal.completed_at) return { completed_at: null };
  return null;
}
