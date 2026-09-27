"use client";

import Select from "./Select";
import { RECURRENCE_PRESET_OPTIONS } from "../../lib/recurrence";

const PRIORITY_OPTIONS = [{ value: "", label: "N/A" }, "High", "Medium", "Low"];
const EFFORT_OPTIONS = [{ value: "", label: "N/A" }, "Small", "Medium", "Large"];

// The fields shared by every add/edit task form. `form` is shaped like
// EMPTY_TASK_FORM (lib/taskForm.js); `onChange` receives the changed keys.
// Pass `goalOptions` to also show the category and goal pickers, and
// `showName={false}` when the caller renders the name input itself.
export default function TaskFields({
  form,
  onChange,
  idPrefix,
  namePlaceholder,
  autoFocus = false,
  goalOptions,
  showName = true,
}) {
  const id = (suffix) => `${idPrefix}-${suffix}`;

  return (
    <>
      {showName && <div className="field field-full">
        <label htmlFor={id("name")}>Task name</label>
        <input
          id={id("name")}
          type="text"
          placeholder={namePlaceholder}
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          autoFocus={autoFocus}
        />
      </div>}
      {goalOptions && (
        <div className="field">
          <label htmlFor={id("category")}>Category</label>
          <Select
            id={id("category")}
            value={form.category}
            onChange={(category) => onChange({ category })}
            options={["General Life", "Goal-Related"]}
          />
        </div>
      )}
      {goalOptions && form.category === "Goal-Related" && (
        <div className="field">
          <label htmlFor={id("goal")}>Goal</label>
          <Select id={id("goal")} value={form.goalId} onChange={(goalId) => onChange({ goalId })} options={goalOptions} />
        </div>
      )}
      <div className="field">
        <label htmlFor={id("priority")}>Priority</label>
        <Select
          id={id("priority")}
          value={form.priority}
          onChange={(priority) => onChange({ priority })}
          options={PRIORITY_OPTIONS}
          onClear={form.priority ? () => onChange({ priority: "" }) : undefined}
          clearLabel="Clear priority"
        />
      </div>
      <div className="field">
        <label htmlFor={id("effort")}>Effort</label>
        <Select
          id={id("effort")}
          value={form.effort}
          onChange={(effort) => onChange({ effort })}
          options={EFFORT_OPTIONS}
          onClear={form.effort ? () => onChange({ effort: "" }) : undefined}
          clearLabel="Clear effort"
        />
      </div>
      <div className="field">
        <label htmlFor={id("due")}>Due date</label>
        <input
          id={id("due")}
          type="date"
          value={form.dueDate}
          onChange={(e) => onChange({ dueDate: e.target.value })}
        />
      </div>
      <div className="field field-recurring">
        <label htmlFor={id("recurring")}>Recurring</label>
        <input
          id={id("recurring")}
          type="checkbox"
          className="checkbox checkbox-square"
          checked={form.recurring}
          onChange={(e) =>
            onChange(
              e.target.checked
                ? { recurring: true }
                : { recurring: false, recurrencePreset: "daily", recurrenceCustomDays: "2" }
            )
          }
        />
      </div>
      {form.recurring && (
        <div className="field field-repeats">
          <label htmlFor={id("repeats")}>Repeats</label>
          <Select
            id={id("repeats")}
            value={form.recurrencePreset}
            onChange={(recurrencePreset) => onChange({ recurrencePreset })}
            options={RECURRENCE_PRESET_OPTIONS}
          />
        </div>
      )}
      {form.recurring && form.recurrencePreset === "custom" && (
        <div className="field">
          <label htmlFor={id("repeats-days")}>Every N days</label>
          <input
            id={id("repeats-days")}
            type="number"
            min="1"
            value={form.recurrenceCustomDays}
            onChange={(e) => onChange({ recurrenceCustomDays: e.target.value })}
          />
        </div>
      )}
    </>
  );
}
