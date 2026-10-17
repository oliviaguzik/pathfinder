"use client";

import { useState } from "react";
import Icon from "../components/Icon";
import TaskFields from "../components/TaskFields";
import EventFields from "../components/EventFields";
import { eventFieldsFromForm, formatTime, newEventForm } from "../../lib/events";
import { agendaDayLabel } from "../../lib/taskGroups";
import { parseQuickAdd } from "../../lib/parseQuickAdd";
import { EMPTY_TASK_FORM, taskFieldsFromForm } from "../../lib/taskForm";
import { notifyWarning } from "../../lib/notify";
import { usePlan } from "./PlanContext";

// Finished and paused goals are closed (as on the Goals page), so they aren't
// offered for new links.
function goalOptionsFor(goals) {
  const open = goals.filter((g) => !g.completed_at && !g.paused_at);
  return [{ value: "", label: "Select goal…" }, ...open.map((g) => ({ value: g.id, label: g.name }))];
}

// An hour after "HH:MM" (or "" past 11pm), for an event typed with only a start.
function hourLater(time) {
  const hour = Number(time.slice(0, 2)) + 1;
  return hour > 23 ? "" : `${String(hour).padStart(2, "0")}${time.slice(2)}`;
}

// One bar for adding a task or an event. Options expand while typing or via
// "Options"; in Event mode the bar turns teal. Dates (and event times) typed in
// plain words ("Dentist fri 3pm") are picked up, shown under the bar, and can
// be ignored with ×.
export default function AddBar() {
  const { goals, addTask, addEvent } = usePlan();
  const [kind, setKind] = useState("task");
  const [newTask, setNewTask] = useState(EMPTY_TASK_FORM);
  const [newEvent, setNewEvent] = useState(() => newEventForm());
  const [optionsOpen, setOptionsOpen] = useState(false);
  // The words the user chose not to read as a date (× on the preview).
  const [ignored, setIgnored] = useState("");

  const name = kind === "event" ? newEvent.title : newTask.name;
  const expanded = optionsOpen || name.trim() !== "";
  const found = parseQuickAdd(name, { withTime: kind === "event" });
  const parsed = (found.date || found.startTime) && found.phrase !== ignored ? found : null;

  // What will be saved: the typed date / time win over the Options fields.
  const taskForm = parsed?.date ? { ...newTask, dueDate: parsed.date } : newTask;
  const eventForm = parsed
    ? {
        ...newEvent,
        ...(parsed.date && { date: parsed.date }),
        ...(parsed.startTime && {
          allDay: false,
          startTime: parsed.startTime,
          endTime: parsed.endTime || hourLater(parsed.startTime),
        }),
      }
    : newEvent;

  // Changing the date or time by hand means the typed words shouldn't override it.
  function editOptions(setForm, patch, keys) {
    if (parsed && keys.some((k) => k in patch)) setIgnored(parsed.phrase);
    setForm((f) => ({ ...f, ...patch }));
  }

  const preview = parsed && (
    <>
      {parsed.date && (kind === "task" ? `Due ${agendaDayLabel(parsed.date)}` : agendaDayLabel(parsed.date))}
      {parsed.date && parsed.startTime && " · "}
      {parsed.startTime && formatTime(parsed.startTime)}
      {parsed.endTime && ` – ${formatTime(parsed.endTime)}`}
    </>
  );

  async function submit(e) {
    e.preventDefault();
    if (kind === "event") {
      const { fields, error } = eventFieldsFromForm({ ...eventForm, title: parsed ? parsed.title : eventForm.title });
      if (error) return notifyWarning(error);
      const { error: saveError } = await addEvent(fields);
      if (!saveError) {
        setNewEvent(newEventForm());
        setIgnored("");
      }
      return;
    }
    if (!newTask.name.trim()) return notifyWarning("Give the task a name first.");
    await addTask({
      ...taskFieldsFromForm({ ...taskForm, name: parsed ? parsed.title : taskForm.name }),
      category: newTask.category,
      goal_id: newTask.category === "Goal-Related" && newTask.goalId ? newTask.goalId : null,
    });
    setIgnored("");
    // Category, goal, priority and effort stay selected for the next task.
    setNewTask((f) => ({
      ...f,
      name: "",
      dueDate: "",
      recurring: false,
      recurrencePreset: "daily",
      recurrenceCustomDays: "2",
    }));
  }

  return (
    <form className={`quick-add ${expanded ? "expanded" : ""} ${kind === "event" ? "is-event" : ""}`} onSubmit={submit}>
      <div className="quick-add-row">
        <div className="segmented add-kind" role="group" aria-label="What to add">
          <button type="button" className={kind === "task" ? "active" : ""} aria-pressed={kind === "task"} onClick={() => setKind("task")}>
            <Icon name="checkCircle" size={13} /> Task
          </button>
          <button type="button" className={kind === "event" ? "active" : ""} aria-pressed={kind === "event"} onClick={() => setKind("event")}>
            <Icon name="clock" size={13} /> Event
          </button>
        </div>
        <input
          className="quick-add-input"
          type="text"
          placeholder={kind === "event" ? "Add an event… e.g. Dinner friday 7pm" : "Add a task… e.g. Call mom tomorrow"}
          aria-label={kind === "event" ? "Event name" : "Task name"}
          value={name}
          onChange={(e) => {
            if (!e.target.value) setIgnored("");
            if (kind === "event") setNewEvent((f) => ({ ...f, title: e.target.value }));
            else setNewTask((f) => ({ ...f, name: e.target.value }));
          }}
        />
        <button type="button" className="ghost quick-add-options-btn" aria-expanded={expanded} onClick={() => setOptionsOpen((o) => !o)}>
          {expanded ? "Fewer options" : "Options"}
        </button>
        <button type="submit" className={`primary ${kind === "event" ? "event-primary" : ""}`} disabled={!name.trim()}>
          Add
        </button>
      </div>
      {parsed && (
        <div className="quick-add-parsed" role="status">
          <Icon name={kind === "event" ? "clock" : "calendar"} size={13} />
          <span className="quick-add-parsed-when">{preview}</span>
          <span className="quick-add-parsed-from">from “{parsed.phrase}”</span>
          <button
            type="button"
            className="ghost icon-btn quick-add-parsed-ignore"
            onClick={() => setIgnored(parsed.phrase)}
            aria-label={`Don't read “${parsed.phrase}” as a date`}
            title="Keep these words in the name instead"
          >
            ×
          </button>
        </div>
      )}
      {expanded && (
        <div className="quick-add-options">
          {kind === "event" ? (
            <EventFields
              form={eventForm}
              onChange={(patch) => editOptions(setNewEvent, patch, ["date", "allDay", "startTime", "endTime"])}
              idPrefix="new-event"
              showTitle={false}
              showNotes={false}
            />
          ) : (
            <TaskFields
              form={taskForm}
              onChange={(patch) => editOptions(setNewTask, patch, ["dueDate"])}
              idPrefix="task"
              goalOptions={goalOptionsFor(goals)}
              showName={false}
            />
          )}
        </div>
      )}
    </form>
  );
}
