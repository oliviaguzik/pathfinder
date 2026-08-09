export const RECURRENCE_PRESET_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "custom", label: "Custom" },
];

export function presetFromRecurrence(unit, interval) {
  if (unit === "day" && interval === 1) return "daily";
  if (unit === "week" && interval === 1) return "weekly";
  if (unit === "month" && interval === 1) return "monthly";
  return "custom";
}

export function recurrenceFromPreset(preset, customDays) {
  if (preset === "daily") return { unit: "day", interval: 1 };
  if (preset === "weekly") return { unit: "week", interval: 1 };
  if (preset === "monthly") return { unit: "month", interval: 1 };
  return { unit: "day", interval: Math.max(1, parseInt(customDays, 10) || 1) };
}

export function recurrenceLabel(task) {
  const unit = task.recurrence_unit || "day";
  const interval = task.recurrence_interval || 1;
  if (interval === 1) return `Repeats every ${unit}`;
  return `Repeats every ${interval} ${unit}s`;
}

export function addRecurrenceInterval(date, unit, interval) {
  const d = new Date(date);
  if (unit === "week") d.setDate(d.getDate() + interval * 7);
  else if (unit === "month") d.setMonth(d.getMonth() + interval);
  else d.setDate(d.getDate() + interval);
  return d;
}

// Given a just-completed recurring task, build the payload for its next occurrence.
export function nextOccurrence(task, toISODateLocalFn, parseLocalDateFn) {
  const baseDate = task.due_date ? parseLocalDateFn(task.due_date) : new Date();
  const next = addRecurrenceInterval(baseDate, task.recurrence_unit || "day", task.recurrence_interval || 1);
  return {
    name: task.name,
    category: task.category,
    goal_id: task.goal_id,
    priority: task.priority,
    effort: task.effort,
    due_date: toISODateLocalFn(next),
    status: "To Do",
    recurring: true,
    recurrence_unit: task.recurrence_unit,
    recurrence_interval: task.recurrence_interval,
  };
}
