import Icon from "./Icon";
import { daysFromToday, friendlyDate } from "../../lib/dates";
import { recurrenceLabel } from "../../lib/recurrence";

function recurrenceShort(task) {
  const unit = task.recurrence_unit || "day";
  const interval = task.recurrence_interval || 1;
  if (interval === 1) return { day: "Daily", week: "Weekly", month: "Monthly" }[unit] || "Repeats";
  return `Every ${interval} ${unit}s`;
}

function dueState(task) {
  if (!task.due_date || task.status === "Done") return "";
  const diff = daysFromToday(task.due_date);
  return diff < 0 ? "overdue" : diff === 0 ? "today" : "";
}

// The small details line under a task name: due date, goal, priority, effort,
// recurrence. `compact` shows just the due date and icon-only priority/recurrence;
// `showDue={false}` hides the date where it's already obvious (calendar days);
// `doneOn` (YYYY-MM-DD) adds "Done Sep 20" for older completed tasks.
export default function TaskMeta({ task, goalName, compact = false, showDue = true, doneOn }) {
  const items = [];

  if (doneOn) {
    items.push(
      <span key="done" className="meta-item" title={`Completed ${doneOn}`}>
        Done {friendlyDate(doneOn)}
      </span>
    );
  }

  if (showDue && task.due_date) {
    const state = dueState(task);
    items.push(
      <span key="due" className={`meta-item due-date ${state}`} title={`Due ${task.due_date}`}>
        {!compact && <Icon name="calendar" size={13} />}
        {state === "overdue" ? `Overdue · ${friendlyDate(task.due_date)}` : friendlyDate(task.due_date)}
      </span>
    );
  }
  if (!compact && goalName) {
    items.push(
      <span key="goal" className="meta-item" title="Goal">
        <Icon name="target" size={13} />
        {goalName}
      </span>
    );
  }
  if (task.priority) {
    items.push(
      <span
        key="priority"
        className={`meta-item priority-${task.priority.toLowerCase()}`}
        title={`${task.priority} priority`}
      >
        <Icon name="flag" size={13} />
        {!compact && task.priority}
      </span>
    );
  }
  if (!compact && task.effort) {
    items.push(
      <span key="effort" className="meta-item" title="Effort">
        {task.effort} effort
      </span>
    );
  }
  if (task.recurring) {
    items.push(
      <span key="repeat" className="meta-item" title={recurrenceLabel(task)}>
        <Icon name="repeat" size={13} />
        {!compact && recurrenceShort(task)}
      </span>
    );
  }

  if (items.length === 0) return null;
  return <div className={`task-meta ${compact ? "compact" : ""}`}>{items}</div>;
}
