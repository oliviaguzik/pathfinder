import { supabase } from "./supabaseClient";
import { nextOccurrence } from "./recurrence";
import { parseLocalDate, toISODateLocal } from "./dates";
import { syncGoalStatuses } from "./goalCompletion";

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
