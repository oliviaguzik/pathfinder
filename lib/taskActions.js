import { supabase } from "./supabaseClient";
import { nextOccurrence } from "./recurrence";
import { parseLocalDate, toISODateLocal } from "./dates";
import { syncGoalStatuses } from "./goalCompletion";
import { taskFieldsFromForm } from "./taskForm";

// Checks or unchecks a task: records when it was completed (for Today and
// Review), creates the next occurrence of a recurring task, and keeps the
// task's goal status in sync. `tasks` and `goals` are the lists as loaded.
export async function toggleTaskDone(task, { tasks, goals, userId }) {
  const done = task.status !== "Done";
  const newStatus = done ? "Done" : "To Do";
  await supabase
    .from("tasks")
    .update({ status: newStatus, completed_at: done ? new Date().toISOString() : null })
    .eq("id", task.id);
  if (done && task.recurring) {
    await supabase.from("tasks").insert({ ...nextOccurrence(task, toISODateLocal, parseLocalDate), user_id: userId });
  }
  const tasksAfter = tasks.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t));
  await syncGoalStatuses([task.goal_id], goals, tasksAfter);
}

// Saves an edited task from its form (lib/taskForm.js) and, if its goal
// changed, keeps both goals' statuses in sync.
export async function saveTaskEdit(task, form, { tasks, goals }) {
  const newGoalId = form.category === "Goal-Related" && form.goalId ? form.goalId : null;
  const { error } = await supabase
    .from("tasks")
    .update({ ...taskFieldsFromForm(form), category: form.category, goal_id: newGoalId })
    .eq("id", task.id);
  if (error) return { error };
  if (task.goal_id !== newGoalId) {
    const tasksAfter = tasks.map((t) => (t.id === task.id ? { ...t, goal_id: newGoalId } : t));
    await syncGoalStatuses([task.goal_id, newGoalId], goals, tasksAfter);
  }
  return {};
}

// Deletes a task and keeps its goal's status in sync.
export async function deleteTaskAndSync(task, { tasks, goals }) {
  await supabase.from("tasks").delete().eq("id", task.id);
  await syncGoalStatuses([task.goal_id], goals, tasks.filter((t) => t.id !== task.id));
}
