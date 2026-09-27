import { presetFromRecurrence, recurrenceFromPreset } from "./recurrence";

// Form state shared by every add/edit task form (see app/components/TaskFields.js).
export const EMPTY_TASK_FORM = {
  name: "",
  category: "General Life",
  goalId: "",
  priority: "",
  effort: "",
  dueDate: "",
  recurring: false,
  recurrencePreset: "daily",
  recurrenceCustomDays: "2",
};

export function taskFormFromTask(task) {
  return {
    name: task.name,
    category: task.category,
    goalId: task.goal_id || "",
    priority: task.priority || "",
    effort: task.effort || "",
    dueDate: task.due_date || "",
    recurring: !!task.recurring,
    recurrencePreset: presetFromRecurrence(task.recurrence_unit || "day", task.recurrence_interval || 1),
    recurrenceCustomDays: String(task.recurrence_interval || 2),
  };
}

// The task columns every form writes. Category and goal are left to the
// caller, since only the Tasks page lets you pick them.
export function taskFieldsFromForm(form) {
  const recurrence = form.recurring ? recurrenceFromPreset(form.recurrencePreset, form.recurrenceCustomDays) : null;
  return {
    name: form.name,
    priority: form.priority || null,
    effort: form.effort || null,
    due_date: form.dueDate || null,
    recurring: form.recurring,
    recurrence_unit: recurrence?.unit || null,
    recurrence_interval: recurrence?.interval || 1,
  };
}
