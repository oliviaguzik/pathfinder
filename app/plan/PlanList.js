"use client";

import { useState } from "react";
import Icon from "../components/Icon";
import Skeleton from "../components/Skeleton";
import { localDateOf } from "../../lib/dates";
import { groupCompleted, isOverdue } from "../../lib/taskGroups";
import { positionBetween, sortByPosition } from "../../lib/reorder";
import { usePlan } from "./PlanContext";
import { ListEvent, TaskRow } from "./rows";

const COMPLETED_PAGE = 10;

// The list view: Scheduled (Overdue, then a heading per day with its events
// and tasks, then Completed) beside No date. Drag a task onto a day or into
// No date to change its date; within a day, dragging reorders.
export default function PlanList({ agenda, taskGroups, hiddenEventCount, filtersOn, showDone, sortBy, onSortChange }) {
  const { tasks, loading, moveTaskToDate, setTaskPosition } = usePlan();
  const [showCompleted, setShowCompleted] = useState(false);
  const [completedLimit, setCompletedLimit] = useState(COMPLETED_PAGE);
  const [draggedId, setDraggedId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [dragOverDay, setDragOverDay] = useState(null);

  const completedOpen = showCompleted || showDone;
  // Completed: newest first, by when it was finished, a page at a time.
  let budget = completedLimit;
  const completedGroups = groupCompleted(taskGroups.completed)
    .map((g) => {
      const shown = g.tasks.slice(0, Math.max(0, budget));
      budget -= shown.length;
      return { ...g, tasks: shown };
    })
    .filter((g) => g.tasks.length > 0);
  const completedShown = completedGroups.flatMap((g) => g.tasks);
  const completedHidden = taskGroups.completed.length - completedShown.length;
  // Reordering switches to the Custom sort, so the new position is worked out
  // among the target's own group (same date, same done state) in custom order:
  // the order you'll see once it's dropped.
  function reorder(id, target, placeAfter) {
    const group = sortByPosition(
      tasks.filter((t) => t.id !== id && t.due_date === target.due_date && (t.status === "Done") === (target.status === "Done"))
    );
    const targetIndex = group.findIndex((t) => t.id === target.id);
    if (targetIndex === -1) return;
    const insertIndex = placeAfter ? targetIndex + 1 : targetIndex;
    const position = positionBetween(group[insertIndex - 1]?.position, group[insertIndex]?.position);
    if (sortBy !== "custom") onSortChange("custom");
    setTaskPosition(id, position);
  }

  // Dropping a task on another task: onto a different day (or into No date)
  // moves it there; within the same day it reorders.
  function dropOnTask(target, placeAfter) {
    const dragged = tasks.find((t) => t.id === draggedId);
    if (!dragged || dragged.id === target.id) return;
    if (dragged.due_date !== target.due_date) {
      if (!isOverdue(target)) moveTaskToDate(dragged.id, target.due_date);
      return;
    }
    reorder(dragged.id, target, placeAfter);
  }

  function dragFor(task) {
    return {
      rowProps: {
        onDragOver: (e) => {
          if (!draggedId) return;
          e.preventDefault();
          setDragOverId(task.id);
        },
        onDragLeave: () => setDragOverId((id) => (id === task.id ? null : id)),
        onDrop: (e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOverId(null);
          setDragOverDay(null);
          const rect = e.currentTarget.getBoundingClientRect();
          dropOnTask(task, e.clientY > rect.top + rect.height / 2);
          setDraggedId(null);
        },
      },
      handleProps: {
        onDragStart: (e) => {
          e.dataTransfer.effectAllowed = "move";
          setDraggedId(task.id);
        },
        onDragEnd: () => {
          setDraggedId(null);
          setDragOverId(null);
        },
      },
    };
  }

  // Drag a task onto a day (or into No date) to give it that date.
  function dropZone(key, dateStr) {
    return {
      onDragOver: (e) => {
        if (!draggedId) return;
        e.preventDefault();
        setDragOverDay(key);
      },
      onDragLeave: (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDragOverDay((d) => (d === key ? null : d));
      },
      onDrop: (e) => {
        e.preventDefault();
        setDragOverDay(null);
        if (draggedId) moveTaskToDate(draggedId, dateStr);
        setDraggedId(null);
      },
    };
  }

  function row(task, options = {}) {
    return <TaskRow key={task.id} task={task} drag={dragFor(task)} dragOver={dragOverId === task.id} {...options} />;
  }

  return (
    <div className="plan-columns">
      <div className="card task-list-card plan-scheduled">
        <h2 className="plan-col-title">Scheduled</h2>
        {loading && <Skeleton rows={4} />}
        {!loading && hiddenEventCount > 0 && (
          <p className="list-note">
            <Icon name="clock" size={13} />
            {hiddenEventCount === 1 ? "1 event is" : `${hiddenEventCount} events are`} hidden while filters are on.
          </p>
        )}
        {!loading && agenda.length === 0 && (
          <p className="plan-empty">
            {filtersOn ? "No scheduled tasks match these filters." : "Nothing scheduled. Give a task a date, or add an event."}
          </p>
        )}
        {agenda.map((day) => (
          <section
            className={`plan-day ${day.key === "overdue" ? "overdue" : ""} ${dragOverDay === day.key ? "drag-over" : ""}`}
            key={day.key}
            {...(day.key !== "overdue" ? dropZone(day.key, day.key) : {})}
          >
            <h3 className="plan-day-label">{day.label}</h3>
            {day.events.map((ev) => (
              <ListEvent key={`e${ev.id}`} event={ev} />
            ))}
            {day.tasks.map((t) => row(t, { showDue: day.key === "overdue", plainDue: true }))}
          </section>
        ))}
        {taskGroups.completed.length > 0 && (
          <section className="task-group task-group-completed">
            <h2 className="task-group-header">
              <button
                type="button"
                className="task-group-toggle"
                aria-expanded={completedOpen}
                onClick={() => setShowCompleted((v) => !v)}
              >
                <span className={`task-group-chevron ${completedOpen ? "open" : ""}`}>
                  <Icon name="chevronRight" size={14} />
                </span>
                Completed
                <span className="task-group-count">{taskGroups.completed.length}</span>
              </button>
            </h2>
            {completedOpen && (
              <>
                {completedGroups.map((g) => (
                  <div key={g.key}>
                    <div className="completed-subhead">{g.label}</div>
                    {g.tasks.map((t) =>
                      row(t, { doneOn: g.key === "older" && t.completed_at ? localDateOf(t.completed_at) : null })
                    )}
                  </div>
                ))}
                <div className="completed-footer">
                  {completedHidden > 0 && (
                    <button type="button" className="ghost small-btn" onClick={() => setCompletedLimit((n) => n + COMPLETED_PAGE)}>
                      Show more ({completedHidden})
                    </button>
                  )}
                  <a className="completed-review-link" href="/review">
                    See your week in Review <Icon name="chevronRight" size={13} />
                  </a>
                </div>
              </>
            )}
          </section>
        )}
      </div>

      <div className={`card task-list-card plan-undated ${dragOverDay === "noDate" ? "drag-over" : ""}`} {...dropZone("noDate", null)}>
        <h2 className="plan-col-title">
          No date
          {taskGroups.noDate.length > 0 && <span className="task-group-count">{taskGroups.noDate.length}</span>}
        </h2>
        {loading && <Skeleton rows={3} />}
        {!loading && taskGroups.noDate.length === 0 && <p className="plan-empty">Every task has a date.</p>}
        {taskGroups.noDate.map((t) => row(t))}
      </div>
    </div>
  );
}
