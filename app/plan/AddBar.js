"use client";

import { useState } from "react";
import Icon from "../components/Icon";
import TaskFields from "../components/TaskFields";
import EventFields from "../components/EventFields";
import { eventFieldsFromForm, newEventForm } from "../../lib/events";
import { EMPTY_TASK_FORM, taskFieldsFromForm } from "../../lib/taskForm";
import { notifyWarning } from "../../lib/notify";
import { usePlan } from "./PlanContext";

// Finished and paused goals are closed (as on the Goals page), so they aren't
// offered for new links.
function goalOptionsFor(goals) {
  const open = goals.filter((g) => !g.completed_at && !g.paused_at);
  return [{ value: "", label: "Select goal…" }, ...open.map((g) => ({ value: g.id, label: g.name }))];
}

// One bar for adding a task or an event. Options expand while typing or via
// "Options"; in Event mode the bar turns teal.
export default function AddBar() {
  const { goals, addTask, addEvent } = usePlan();
  const [kind, setKind] = useState("task");
  const [newTask, setNewTask] = useState(EMPTY_TASK_FORM);
  const [newEvent, setNewEvent] = useState(() => newEventForm());
  const [optionsOpen, setOptionsOpen] = useState(false);

  const name = kind === "event" ? newEvent.title : newTask.name;
  const expanded = optionsOpen || name.trim() !== "";

  async function submit(e) {
    e.preventDefault();
    if (kind === "event") {
      const { fields, error } = eventFieldsFromForm(newEvent);
      if (error) return notifyWarning(error);
      const { error: saveError } = await addEvent(fields);
      if (!saveError) setNewEvent(newEventForm());
      return;
    }
    if (!newTask.name.trim()) return notifyWarning("Give the task a name first.");
    await addTask({
      ...taskFieldsFromForm(newTask),
      category: newTask.category,
      goal_id: newTask.category === "Goal-Related" && newTask.goalId ? newTask.goalId : null,
    });
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
          placeholder={kind === "event" ? "Add an event…" : "Add a task…"}
          aria-label={kind === "event" ? "Event name" : "Task name"}
          value={name}
          onChange={(e) =>
            kind === "event"
              ? setNewEvent((f) => ({ ...f, title: e.target.value }))
              : setNewTask((f) => ({ ...f, name: e.target.value }))
          }
        />
        <button type="button" className="ghost quick-add-options-btn" aria-expanded={expanded} onClick={() => setOptionsOpen((o) => !o)}>
          {expanded ? "Fewer options" : "Options"}
        </button>
        <button type="submit" className={`primary ${kind === "event" ? "event-primary" : ""}`} disabled={!name.trim()}>
          Add
        </button>
      </div>
      {expanded && (
        <div className="quick-add-options">
          {kind === "event" ? (
            <EventFields
              form={newEvent}
              onChange={(patch) => setNewEvent((f) => ({ ...f, ...patch }))}
              idPrefix="new-event"
              showTitle={false}
              showNotes={false}
            />
          ) : (
            <TaskFields
              form={newTask}
              onChange={(patch) => setNewTask((f) => ({ ...f, ...patch }))}
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
