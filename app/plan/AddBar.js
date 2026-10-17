"use client";

import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import HighlightInput from "../components/HighlightInput";
import Popover from "../components/Popover";
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

// Examples the empty box cycles through, so the plain-word dates get noticed.
const EXAMPLES = {
  task: ["Call mom tomorrow", "Pay rent on the 1st", "Dentist fri", "Renew passport in 2 weeks", "Taxes oct 20"],
  event: ["Dinner friday 7pm", "Haircut tue 3-4pm", "Lunch tomorrow at noon", "Yoga next monday 6pm"],
};

// An hour after "HH:MM" (or "" past 11pm), for an event typed with only a start.
function hourLater(time) {
  const hour = Number(time.slice(0, 2)) + 1;
  return hour > 23 ? "" : `${String(hour).padStart(2, "0")}${time.slice(2)}`;
}

// One bar for adding a task or an event. Options expand while typing or via
// "Options"; in Event mode the bar turns teal. Dates (and event times) typed in
// plain words ("Dentist fri 3pm") are picked up, shown under the bar, and can
// be ignored with ×.
// In the phone sheet (`inSheet`), options are always open, the box is focused,
// and `onAdded` closes the sheet after a save.
export default function AddBar({ inSheet = false, onAdded }) {
  const { goals, addTask, addEvent } = usePlan();
  const [kind, setKind] = useState("task");
  const [newTask, setNewTask] = useState(EMPTY_TASK_FORM);
  const [newEvent, setNewEvent] = useState(() => newEventForm());
  const [optionsOpen, setOptionsOpen] = useState(false);
  // The words the user chose not to read as a date (× on the preview).
  const [ignored, setIgnored] = useState("");
  const [exampleIndex, setExampleIndex] = useState(0);


  const name = kind === "event" ? newEvent.title : newTask.name;
  const expanded = inSheet || optionsOpen || name.trim() !== "";
  const found = parseQuickAdd(name, { withTime: kind === "event" });
  const parsed = (found.date || found.startTime) && found.phrase !== ignored ? found : null;

  // While the box is empty, show a new example every few seconds.
  const examples = EXAMPLES[kind];
  useEffect(() => {
    if (name) return;
    const timer = setInterval(() => setExampleIndex((i) => i + 1), 3500);
    return () => clearInterval(timer);
  }, [name]);
  const example = examples[exampleIndex % examples.length];

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
        onAdded?.();
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
    onAdded?.();
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
    <form className={`quick-add ${expanded ? "expanded" : ""} ${kind === "event" ? "is-event" : ""} ${inSheet ? "in-sheet" : ""}`} onSubmit={submit}>
      <div className="quick-add-row">
        <div className="segmented add-kind" role="group" aria-label="What to add">
          <button type="button" className={kind === "task" ? "active" : ""} aria-pressed={kind === "task"} onClick={() => setKind("task")}>
            <Icon name="checkCircle" size={13} /> Task
          </button>
          <button type="button" className={kind === "event" ? "active" : ""} aria-pressed={kind === "event"} onClick={() => setKind("event")}>
            <Icon name="clock" size={13} /> Event
          </button>
        </div>
        <HighlightInput
          className="quick-add-input-wrap"
          highlights={parsed ? found.phrases : []}
          tone={kind === "event" ? "event" : "accent"}
          autoFocus={inSheet}
          type="text"
          placeholder={`${kind === "event" ? "Add an event" : "Add a task"}… e.g. ${example}`}
          aria-label={kind === "event" ? "Event name" : "Task name"}
          value={name}
          onChange={(e) => {
            if (!e.target.value) setIgnored("");
            if (kind === "event") setNewEvent((f) => ({ ...f, title: e.target.value }));
            else setNewTask((f) => ({ ...f, name: e.target.value }));
          }}
          inputClassName="quick-add-input"
        />
        <Popover bare ariaLabel={kind === "event" ? "How to type a day and time" : "How to type a due date"} label={<Icon name="info" size={16} />}>
          <p className="typed-dates-help">
            {kind === "event"
              ? "Add the day and time by typing them, like “fri 7pm”, “tomorrow at noon” or “oct 20 3-4pm”."
              : "Add a due date by typing it, like “tomorrow”, “fri” or “oct 20”."}
          </p>
        </Popover>
        {!inSheet && (
          <button type="button" className="ghost quick-add-options-btn" aria-expanded={expanded} onClick={() => setOptionsOpen((o) => !o)}>
            {expanded ? "Fewer options" : "Options"}
          </button>
        )}
        <button type="submit" className={`primary ${kind === "event" ? "event-primary" : ""}`} disabled={!name.trim()}>
          Add
        </button>
      </div>
      {parsed && (
        <div className="quick-add-parsed" role="status">
          <Icon name={kind === "event" ? "clock" : "calendar"} size={13} />
          <span className="quick-add-parsed-when">{preview}</span>
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
              idPrefix={inSheet ? "sheet-event" : "new-event"}
              showTitle={false}
              showNotes={false}
              dateHint="or type it in the name, e.g. “fri 7pm”"
            />
          ) : (
            <TaskFields
              form={taskForm}
              onChange={(patch) => editOptions(setNewTask, patch, ["dueDate"])}
              idPrefix={inSheet ? "sheet-task" : "task"}
              goalOptions={goalOptionsFor(goals)}
              showName={false}
              dateHint="or type it in the name, e.g. “next fri”"
            />
          )}
        </div>
      )}
    </form>
  );
}
