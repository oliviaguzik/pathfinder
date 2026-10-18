"use client";

import Icon from "../components/Icon";
import TaskMeta from "../components/TaskMeta";
import EventRow from "../components/EventRow";
import DueDateMenu from "../components/DueDateMenu";
import { eventTimeLabel, formatTime } from "../../lib/events";
import { friendlyDate } from "../../lib/dates";
import { isDueToday, isOverdue } from "../../lib/taskGroups";
import { openOnKey, openOnRowClick } from "../../lib/rowClick";
import { usePlan } from "./PlanContext";
import { useSwipeRow } from "../../lib/useSwipeRow";

function goalNameFor(task, goalName) {
  return task.category === "Goal-Related" && task.goal_id ? goalName(task.goal_id) : "";
}

function TaskCheckbox({ task }) {
  const { isDone, toggleDone } = usePlan();
  return (
    <input
      type="checkbox"
      className="checkbox"
      checked={isDone(task)}
      onChange={() => toggleDone(task)}
      aria-label={`Mark "${task.name}" ${isDone(task) ? "not done" : "done"}`}
    />
  );
}

// The title of a row: focusable, so Enter or Space opens it like a click.
function RowTitle({ className, onOpen, children, title }) {
  return (
    <span className={className} role="button" tabIndex={0} onKeyDown={openOnKey(onOpen)} title={title}>
      {children}
    </span>
  );
}

// A full-size task row (list view, day popup, Day view). `drag` adds the drag
// handle and drop handling (list view only). A just-ticked row pops, then fades
// out, unless it `stays` in place (lists that keep finished tasks).
export function TaskRow({ task, doneOn, showDue = true, plainDue = false, drag, dragOver = false, stays = false }) {
  const { isDone, lingering, openTask, deleteTask, moveTaskToDate, goalName, toggleDone } = usePlan();
  const open = () => openTask(task);
  // Touch screens: swipe right to tick off (or un-tick), left to delete.
  const swipe = useSwipeRow({ onRight: () => toggleDone(task), onLeft: () => deleteTask(task.id) });
  return (
    <div
      className={`task-row clickable-row ${dragOver ? "drag-over" : ""} ${lingering.has(task.id) ? (stays ? "just-done" : "just-done leaving") : ""}`}
      onClick={openOnRowClick(open)}
      data-swipe-right={isDone(task) ? "Not done" : "Done"}
      {...swipe}
      {...drag?.rowProps}
    >
      {drag && (
        <span className="drag-handle" draggable {...drag.handleProps} aria-label="Drag to reorder" title="Drag to reorder">
          <Icon name="dragHandle" size={13} />
        </span>
      )}
      <TaskCheckbox task={task} />
      <div className="task-main">
        <RowTitle className={`task-name ${isDone(task) ? "done" : ""}`} onOpen={open}>
          {task.name}
        </RowTitle>
        <TaskMeta
          task={task}
          doneOn={doneOn}
          showDue={showDue}
          plainDue={plainDue}
          onReschedule={(date) => moveTaskToDate(task.id, date)}
          goalName={goalNameFor(task, goalName)}
        />
      </div>
      <div className="task-actions">
        <button className="ghost icon-btn" onClick={() => deleteTask(task.id)} aria-label="Delete task" title="Delete">
          ×
        </button>
      </div>
    </div>
  );
}

// An event among full-size task rows.
export function ListEvent({ event, showDate = false }) {
  const { openEvent, removeEvent } = usePlan();
  const when = showDate ? `${friendlyDate(event.date)} · ${eventTimeLabel(event)}` : eventTimeLabel(event);
  return <EventRow event={event} when={when} onOpen={() => openEvent(event)} onDelete={() => removeEvent(event)} />;
}

// A compact task row for the calendar's side panel; `showDate` adds the date
// (as a "Move to" menu) under the name.
export function SideTaskRow({ task, showDate = false, onDragStart, onDragEnd }) {
  const { isDone, openTask, deleteTask, moveTaskToDate } = usePlan();
  const open = () => openTask(task);
  return (
    <div
      className="undated-task-row clickable-row"
      onClick={openOnRowClick(open)}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <TaskCheckbox task={task} />
      <div className="upcoming-task-info">
        <RowTitle className={`upcoming-task-name ${isDone(task) ? "done" : ""}`} onOpen={open}>
          {task.name}
        </RowTitle>
        {showDate && (
          <div className="upcoming-task-due">
            <DueDateMenu
              dueDate={task.due_date}
              className={isOverdue(task) ? "due-date overdue" : isDueToday(task) ? "due-date today" : "muted due-date"}
              onPick={(date) => moveTaskToDate(task.id, date)}
            >
              {friendlyDate(task.due_date)}
            </DueDateMenu>
          </div>
        )}
      </div>
      <button className="ghost row-delete-btn" onClick={() => deleteTask(task.id)} aria-label="Delete task" title="Delete">
        ×
      </button>
    </div>
  );
}

export function SideEventRow({ event }) {
  const { openEvent, removeEvent } = usePlan();
  const open = () => openEvent(event);
  return (
    <div className="undated-task-row agenda-event clickable-row" onClick={openOnRowClick(open)}>
      <Icon name="clock" size={12} />
      <span className="agenda-event-time">{event.all_day || !event.start_time ? "All day" : formatTime(event.start_time)}</span>
      <RowTitle className="agenda-event-title" onOpen={open}>
        {event.title}
      </RowTitle>
      <button className="ghost row-delete-btn" onClick={() => removeEvent(event)} aria-label="Delete event" title="Delete">
        ×
      </button>
    </div>
  );
}

// A task chip in a month cell. Clicks stop here so the day popup doesn't open.
export function CalendarTaskChip({ task, onDragStart, onDragEnd }) {
  const { isDone, openTask } = usePlan();
  const open = () => openTask(task);
  return (
    <div
      className="calendar-task"
      draggable
      onClick={(e) => {
        e.stopPropagation();
        openOnRowClick(open)(e);
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <TaskCheckbox task={task} />
      <RowTitle className={`calendar-task-name ${isDone(task) ? "done" : ""}`} onOpen={open} title={task.name}>
        {task.name}
      </RowTitle>
    </div>
  );
}

export function CalendarEventChip({ event }) {
  const { openEvent } = usePlan();
  return (
    <button
      type="button"
      className="calendar-event"
      title={`${eventTimeLabel(event)} · ${event.title}${event.location ? ` · ${event.location}` : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        openEvent(event);
      }}
    >
      <Icon name="clock" size={11} />
      {!event.all_day && <span className="calendar-event-time">{formatTime(event.start_time)}</span>}
      <span className="calendar-event-title">{event.title}</span>
    </button>
  );
}

// A task in a Week view column.
export function WeekTask({ task, onDragStart, onDragEnd }) {
  const { isDone, openTask } = usePlan();
  const open = () => openTask(task);
  return (
    <div
      className={`calendar-week-task clickable-row ${isDone(task) ? "done" : ""}`}
      onClick={openOnRowClick(open)}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <TaskCheckbox task={task} />
      <div className="task-main">
        <RowTitle className={`task-name ${isDone(task) ? "done" : ""}`} onOpen={open}>
          {task.name}
        </RowTitle>
        <TaskMeta task={task} compact showDue={false} />
      </div>
    </div>
  );
}

export function WeekEvent({ event }) {
  const { openEvent } = usePlan();
  return (
    <button type="button" className="calendar-week-event" onClick={() => openEvent(event)}>
      <span className="calendar-week-event-time">
        <Icon name="clock" size={11} /> {eventTimeLabel(event)}
      </span>
      <span className="calendar-week-event-title">{event.title}</span>
      {event.location && <span className="calendar-week-event-location">{event.location}</span>}
    </button>
  );
}
