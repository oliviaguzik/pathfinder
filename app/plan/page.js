"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Select from "../components/Select";
import Modal from "../components/Modal";
import Popover from "../components/Popover";
import Skeleton from "../components/Skeleton";
import Icon from "../components/Icon";
import TaskFields from "../components/TaskFields";
import TaskMeta from "../components/TaskMeta";
import EventModal from "../components/EventModal";
import TaskEditModal from "../components/TaskEditModal";
import EventFields from "../components/EventFields";
import { eventFieldsFromForm, eventTimeLabel, formatTime, newEventForm, sortEvents } from "../../lib/events";
import { deleteTaskAndSync, toggleTaskDone } from "../../lib/taskActions";
import { positionBetween, nextPosition, sortByPosition } from "../../lib/reorder";
import { friendlyDate, getWeekDays, localDateOf, parseLocalDate, toISODateLocal, weekLabel } from "../../lib/dates";
import { buildAgenda, groupCompleted, groupTasksByDue } from "../../lib/taskGroups";
import { EMPTY_TASK_FORM, taskFieldsFromForm } from "../../lib/taskForm";
import { useAuth } from "../../lib/AuthProvider";
import { notifyWarning } from "../../lib/notify";

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getMonthGrid(year, month) {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - i), outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), outside: false });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), outside: true });
  }
  return cells;
}

function isOverdue(task) {
  if (!task.due_date || task.status === "Done") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parseLocalDate(task.due_date) < today;
}

function isDueToday(task) {
  if (!task.due_date || task.status === "Done") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parseLocalDate(task.due_date).getTime() === today.getTime();
}

const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };

const EFFORT_RANK = { Small: 0, Medium: 1, Large: 2 };

function sortByCriterion(list, sortBy) {
  if (sortBy === "due") {
    return [...list].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    });
  }
  if (sortBy === "priority") {
    return [...list].sort((a, b) => (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3));
  }
  if (sortBy === "effort") {
    return [...list].sort((a, b) => (EFFORT_RANK[a.effort] ?? 3) - (EFFORT_RANK[b.effort] ?? 3));
  }
  if (sortBy === "oldest") {
    return [...list].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }
  if (sortBy === "newest") {
    return [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  if (sortBy === "custom") {
    return sortByPosition(list);
  }
  return list;
}

// Completed tasks always sink to the bottom, regardless of the active sort.
function sortTasksList(list, sortBy) {
  const notDone = list.filter((t) => t.status !== "Done");
  const done = list.filter((t) => t.status === "Done");
  return [...sortByCriterion(notDone, sortBy), ...sortByCriterion(done, sortBy)];
}

function sortDoneLast(list) {
  return [...list].sort((a, b) => (a.status === "Done") - (b.status === "Done"));
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_CELL_LIMIT = 3;
const COMPLETED_PAGE = 10;


export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");
  const [filterEffort, setFilterEffort] = useState("All");
  const [sortBy, setSortBy] = useState("due");

  const [view, setView] = useState("list");
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarMode, setCalendarMode] = useState("month");
  const [events, setEvents] = useState([]);
  // The event dialog: { event } to edit one, { date } to add one on a day.
  const [eventDialog, setEventDialog] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayTaskName, setDayTaskName] = useState("");
  const calendarMainRef = useRef(null);
  const [calendarSideMaxHeight, setCalendarSideMaxHeight] = useState(null);

  const [newTask, setNewTask] = useState(EMPTY_TASK_FORM);
  const [optionsOpen, setOptionsOpen] = useState(false);
  // The Add bar adds either a task or an event.
  const [addKind, setAddKind] = useState("task");
  const [newEvent, setNewEvent] = useState(() => newEventForm());
  const [showCompleted, setShowCompleted] = useState(false);
  const [completedLimit, setCompletedLimit] = useState(COMPLETED_PAGE);
  // The task open in the edit dialog (the same dialog everywhere).
  const [editingTask, setEditingTask] = useState(null);

  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const [dragOverDay, setDragOverDay] = useState(null);
  const [confirmingDeleteTaskId, setConfirmingDeleteTaskId] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("tasksView");
    if (stored === "list" || stored === "calendar") setView(stored);
    const storedMode = localStorage.getItem("calendarMode");
    if (["month", "week", "day"].includes(storedMode)) setCalendarMode(storedMode);
  }, []);

  function changeCalendarMode(next) {
    setCalendarMode(next);
    localStorage.setItem("calendarMode", next);
  }

  function shiftCalendar(direction) {
    const d = calendarDate;
    if (calendarMode === "month") {
      setCalendarDate(new Date(d.getFullYear(), d.getMonth() + direction, 1));
    } else {
      const days = calendarMode === "week" ? 7 : 1;
      setCalendarDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days * direction));
    }
  }

  function openDay(dateStr) {
    setSelectedDay(dateStr);
    setDayTaskName("");
  }

  function changeView(next) {
    setView(next);
    localStorage.setItem("tasksView", next);
  }

  async function loadData() {
    setLoading(true);
    const [{ data: taskData }, { data: goalData }, { data: eventData }] = await Promise.all([
      supabase.from("tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("goals").select("*"),
      supabase.from("events").select("*"),
    ]);
    setTasks(taskData || []);
    setGoals(goalData || []);
    setEvents(eventData || []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  // Size the side panel (agenda + no date) to the calendar's actual rendered
  // height (measured, since CSS grid/flex stretch alone can't reliably do this —
  // a tall unbounded list inflates the shared row height instead of being capped by it).
  useEffect(() => {
    if (view !== "calendar") return;
    function measure() {
      if (calendarMainRef.current) {
        setCalendarSideMaxHeight(calendarMainRef.current.offsetHeight);
      }
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [view, calendarDate, calendarMode, tasks, events]);

  async function addFromBar(e) {
    e.preventDefault();
    if (addKind === "event") {
      const { fields, error } = eventFieldsFromForm(newEvent);
      if (error) return notifyWarning(error);
      const { error: saveError } = await supabase.from("events").insert(fields);
      if (saveError) return;
      setNewEvent(newEventForm());
      loadData();
      return;
    }
    if (!newTask.name.trim()) return notifyWarning("Give the task a name first.");
    await supabase.from("tasks").insert({
      ...taskFieldsFromForm(newTask),
      category: newTask.category,
      goal_id: newTask.category === "Goal-Related" && newTask.goalId ? newTask.goalId : null,
      status: "To Do",
      position: nextPosition(tasks),
      user_id: user.id,
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
    loadData();
  }

  async function addTaskOnDay(e, dateStr) {
    e.preventDefault();
    if (!dayTaskName.trim() || !dateStr) return;
    await supabase.from("tasks").insert({
      ...taskFieldsFromForm({ ...EMPTY_TASK_FORM, name: dayTaskName, dueDate: dateStr }),
      category: EMPTY_TASK_FORM.category,
      goal_id: null,
      status: "To Do",
      position: nextPosition(tasks),
      user_id: user.id,
    });
    setDayTaskName("");
    loadData();
  }

  async function toggleDone(task) {
    await toggleTaskDone(task, { tasks, goals, userId: user.id });
    loadData();
  }

  async function deleteTask(id) {
    await deleteTaskAndSync(tasks.find((t) => t.id === id), { tasks, goals });
    loadData();
  }

  // First click arms the delete button (auto-disarms after a few seconds);
  // a second click while armed actually deletes. Avoids a fat-finger delete
  // on a dense list without a full confirm panel per row.
  function handleDeleteClick(id) {
    if (confirmingDeleteTaskId === id) {
      deleteTask(id);
      setConfirmingDeleteTaskId(null);
      return;
    }
    setConfirmingDeleteTaskId(id);
    setTimeout(() => {
      setConfirmingDeleteTaskId((current) => (current === id ? null : current));
    }, 3000);
  }

  async function moveTaskToDate(taskId, dueDateStr) {
    await supabase.from("tasks").update({ due_date: dueDateStr }).eq("id", taskId);
    loadData();
  }

  // Dropping a task on another task: onto a different day (or into No date) moves
  // it there; within the same day it reorders.
  async function dropOnTask(draggedId, target, placeAfter) {
    const dragged = tasks.find((t) => t.id === draggedId);
    if (!dragged || dragged.id === target.id) return;
    if (dragged.due_date !== target.due_date) {
      if (!isOverdue(target)) moveTaskToDate(draggedId, target.due_date);
      return;
    }
    reorderTask(draggedId, target.id, placeAfter);
  }

  async function reorderTask(draggedId, targetId, placeAfter) {
    if (!draggedId || draggedId === targetId) return;
    const ordered = displayedTasks.filter((t) => t.id !== draggedId);
    const targetIndex = ordered.findIndex((t) => t.id === targetId);
    if (targetIndex === -1) return;
    const insertIndex = placeAfter ? targetIndex + 1 : targetIndex;
    const prev = ordered[insertIndex - 1];
    const next = ordered[insertIndex];
    const newPosition = positionBetween(prev?.position, next?.position);
    await supabase.from("tasks").update({ position: newPosition }).eq("id", draggedId);
    if (sortBy !== "custom") setSortBy("custom");
    loadData();
  }

  function startEditTask(task) {
    setEditingTask(task);
  }

  const activeFilterCount = [filterCategory, filterStatus, filterPriority, filterEffort].filter(
    (v) => v !== "All"
  ).length;

  const visibleTasks = tasks.filter((t) => {
    if (filterCategory !== "All" && t.category !== filterCategory) return false;
    if (filterStatus !== "All" && t.status !== filterStatus) return false;
    if (filterPriority !== "All" && t.priority !== filterPriority) return false;
    if (filterEffort !== "All" && t.effort !== filterEffort) return false;
    return true;
  });
  const sortedVisibleTasks = sortTasksList(visibleTasks, sortBy);
  const taskGroups = groupTasksByDue(sortedVisibleTasks);
  // Overdue, then each day with its events (next two weeks) and open tasks, in
  // the chosen sort order within a day. Filters are about tasks, so events
  // step aside while any filter is on.
  const agenda = buildAgenda(sortedVisibleTasks, activeFilterCount === 0 ? events : []);
  const hiddenEventCount =
    activeFilterCount > 0 ? buildAgenda([], events).reduce((n, day) => n + day.events.length, 0) : 0;
  const completedOpen = showCompleted || filterStatus === "Done";
  // Completed: newest first, by when it was finished, a page at a time.
  let completedBudget = completedLimit;
  const completedGroups = groupCompleted(taskGroups.completed)
    .map((g) => {
      const shown = g.tasks.slice(0, Math.max(0, completedBudget));
      completedBudget -= shown.length;
      return { ...g, tasks: shown };
    })
    .filter((g) => g.tasks.length > 0);
  const completedShown = completedGroups.flatMap((g) => g.tasks);
  const completedHidden = taskGroups.completed.length - completedShown.length;
  // The list as shown on screen, which drag-reordering positions against.
  const displayedTasks = [
    ...agenda.flatMap((day) => day.tasks),
    ...taskGroups.noDate,
    ...(completedOpen ? completedShown : []),
  ];

  const addName = addKind === "event" ? newEvent.title : newTask.name;
  const quickAddExpanded = optionsOpen || addName.trim() !== "";


  function clearAllFilters() {
    setFilterCategory("All");
    setFilterStatus("All");
    setFilterPriority("All");
    setFilterEffort("All");
  }

  function goalName(id) {
    return goals.find((g) => g.id === id)?.name || "";
  }

  // Finished and paused goals are closed (as on the Goals page), so they aren't offered
  // for new links — except a task's current goal, so editing doesn't unlink it.
  function goalOptions(currentGoalId) {
    const open = goals.filter((g) => (!g.completed_at && !g.paused_at) || g.id === currentGoalId);
    return [{ value: "", label: "Select goal…" }, ...open.map((g) => ({ value: g.id, label: g.name }))];
  }

  function renderTaskRow(t, { doneOn, showDue = true, plainDue = false } = {}) {
    const confirming = confirmingDeleteTaskId === t.id;
    const overdue = isOverdue(t);
    return (
      <div
        className={`task-row ${dragOverTaskId === t.id ? "drag-over" : ""} ${confirming ? "confirming" : ""}`}
        key={t.id}
        onDragOver={(e) => {
          if (!draggedTaskId) return;
          e.preventDefault();
          setDragOverTaskId(t.id);
        }}
        onDragLeave={() => setDragOverTaskId((id) => (id === t.id ? null : id))}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOverTaskId(null);
          setDragOverDay(null);
          const rect = e.currentTarget.getBoundingClientRect();
          const placeAfter = e.clientY > rect.top + rect.height / 2;
          dropOnTask(draggedTaskId, t, placeAfter);
          setDraggedTaskId(null);
        }}
      >
        <span
          className="drag-handle"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            setDraggedTaskId(t.id);
          }}
          onDragEnd={() => {
            setDraggedTaskId(null);
            setDragOverTaskId(null);
          }}
          aria-label="Drag to reorder"
          title="Drag to reorder"
        >
          <Icon name="dragHandle" size={13} />
        </span>
        <input
          type="checkbox"
          className="checkbox"
          checked={t.status === "Done"}
          onChange={() => toggleDone(t)}
          aria-label={`Mark "${t.name}" ${t.status === "Done" ? "not done" : "done"}`}
        />
        <div className="task-main">
          <span
            className={`task-name task-name-editable ${t.status === "Done" ? "done" : ""}`}
            onClick={() => startEditTask(t)}
            title="Edit task"
          >
            {t.name}
          </span>
          <TaskMeta
            task={t}
            doneOn={doneOn}
            showDue={showDue}
            plainDue={plainDue}
            goalName={t.category === "Goal-Related" && t.goal_id ? goalName(t.goal_id) : ""}
          />
        </div>
        {overdue && (
          <div className="reschedule">
            <button className="ghost small-btn" onClick={() => moveTaskToDate(t.id, todayStr)}>Today</button>
            <button className="ghost small-btn" onClick={() => moveTaskToDate(t.id, tomorrowStr)}>Tomorrow</button>
          </div>
        )}
        <div className="task-actions">
          <button className="ghost icon-btn" onClick={() => startEditTask(t)} aria-label="Edit task" title="Edit">
            <Icon name="edit" size={14} />
          </button>
          <button
            className={confirming ? "danger icon-btn" : "ghost icon-btn"}
            onClick={() => handleDeleteClick(t.id)}
            aria-label={confirming ? "Confirm delete task" : "Delete task"}
            title={confirming ? "Click again to delete" : "Delete"}
          >
            {confirming ? "Delete?" : "×"}
          </button>
        </div>
      </div>
    );
  }

  // Drag a task onto a day (or into No date) to give it that date.
  function dropZone(key, dateStr) {
    return {
      onDragOver: (e) => {
        if (!draggedTaskId) return;
        e.preventDefault();
        setDragOverDay(key);
      },
      onDragLeave: (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDragOverDay((d) => (d === key ? null : d));
      },
      onDrop: (e) => {
        e.preventDefault();
        setDragOverDay(null);
        if (draggedTaskId) moveTaskToDate(draggedTaskId, dateStr);
        setDraggedTaskId(null);
      },
    };
  }

  // An event in the task list: shaped like a task row so it lines up, but teal
  // with a clock where the checkbox would be. Click to edit.
  function renderListEvent(ev, showDate) {
    const when = showDate ? `${friendlyDate(ev.date)} · ${eventTimeLabel(ev)}` : eventTimeLabel(ev);
    return (
      <button type="button" className="task-row list-event" key={`e${ev.id}`} onClick={() => setEventDialog({ event: ev })}>
        <span className="list-event-icon">
          <Icon name="clock" size={14} />
        </span>
        <span className="task-main">
          <span className="task-name">{ev.title}</span>
          <span className="task-meta">
            <span className="meta-item list-event-when">{when}</span>
            {ev.location && <span className="meta-item">{ev.location}</span>}
          </span>
        </span>
      </button>
    );
  }

  function renderAgendaEvent(ev) {
    return (
      <button type="button" className="agenda-event" key={ev.id} onClick={() => setEventDialog({ event: ev })}>
        <Icon name="clock" size={12} />
        <span className="agenda-event-time">{ev.all_day || !ev.start_time ? "All day" : formatTime(ev.start_time)}</span>
        <span className="agenda-event-title">{ev.title}</span>
      </button>
    );
  }

  function renderUpcomingTaskRow(t, showDate) {
    return (
      <div
        className="undated-task-row"
        key={t.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          setDraggedTaskId(t.id);
        }}
        onDragEnd={() => setDraggedTaskId(null)}
      >
        <input
          type="checkbox"
          className="checkbox"
          checked={t.status === "Done"}
          onChange={() => toggleDone(t)}
        />
        <div className="upcoming-task-info">
          <span
            className={`upcoming-task-name ${t.status === "Done" ? "done" : ""}`}
            onClick={() => startEditTask(t)}
          >
            {t.name}
          </span>
          {showDate && (
            <div className={isOverdue(t) ? "due-date overdue" : isDueToday(t) ? "due-date today" : "muted due-date"}>
              {friendlyDate(t.due_date)}
            </div>
          )}
        </div>
        <button
          className={confirmingDeleteTaskId === t.id ? "danger row-delete-btn" : "ghost row-delete-btn"}
          onClick={() => handleDeleteClick(t.id)}
          aria-label={confirmingDeleteTaskId === t.id ? "Confirm delete task" : "Delete task"}
          title={confirmingDeleteTaskId === t.id ? "Click again to delete" : "Delete"}
        >
          {confirmingDeleteTaskId === t.id ? "Delete?" : "×"}
        </button>
      </div>
    );
  }

  function renderUndatedTaskRow(t) {
    return (
      <div
        className="undated-task-row"
        key={t.id}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          setDraggedTaskId(t.id);
        }}
        onDragEnd={() => setDraggedTaskId(null)}
      >
        <input
          type="checkbox"
          className="checkbox"
          checked={t.status === "Done"}
          onChange={() => toggleDone(t)}
        />
        <span
          className={`undated-task-name ${t.status === "Done" ? "done" : ""}`}
          onClick={() => startEditTask(t)}
        >
          {t.name}
        </span>
        <button
          className={confirmingDeleteTaskId === t.id ? "danger row-delete-btn" : "ghost row-delete-btn"}
          onClick={() => handleDeleteClick(t.id)}
          aria-label={confirmingDeleteTaskId === t.id ? "Confirm delete task" : "Delete task"}
          title={confirmingDeleteTaskId === t.id ? "Click again to delete" : "Delete"}
        >
          {confirmingDeleteTaskId === t.id ? "Delete?" : "×"}
        </button>
      </div>
    );
  }

  function renderCalendarTask(t) {
    return (
      <div
        className="calendar-task"
        key={t.id}
        draggable
        onClick={(e) => e.stopPropagation()}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          setDraggedTaskId(t.id);
        }}
        onDragEnd={() => setDraggedTaskId(null)}
      >
        <input
          type="checkbox"
          className="checkbox"
          checked={t.status === "Done"}
          onChange={() => toggleDone(t)}
          aria-label={`Mark "${t.name}" ${t.status === "Done" ? "not done" : "done"}`}
        />
        <span
          className={`task-name-editable calendar-task-name ${t.status === "Done" ? "done" : ""}`}
          onClick={() => startEditTask(t)}
          title={t.name}
        >
          {t.name}
        </span>
      </div>
    );
  }

  function renderCalendarEvent(ev) {
    return (
      <button
        type="button"
        className="calendar-event"
        key={ev.id}
        title={`${eventTimeLabel(ev)} · ${ev.title}${ev.location ? ` · ${ev.location}` : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setEventDialog({ event: ev });
        }}
      >
        <Icon name="clock" size={11} />
        {!ev.all_day && <span className="calendar-event-time">{formatTime(ev.start_time)}</span>}
        <span className="calendar-event-title">{ev.title}</span>
      </button>
    );
  }

  // A day's events and tasks at full size, plus add boxes for that date — used
  // by the Day view and by the panel that opens when you click a day.
  function renderDayTasks(dateStr) {
    const dayTasks = tasksByDate[dateStr] || [];
    const dayEvents = eventsByDate[dateStr] || [];
    return (
      <div className="day-panel">
        {dayTasks.length === 0 && dayEvents.length === 0 && <p className="muted">Nothing on this day yet.</p>}
        {dayEvents.length > 0 && (
          <>
            <div className="section-heading events">
              <Icon name="clock" size={14} /> Events
            </div>
            {dayEvents.map((ev) => renderListEvent(ev, false))}
          </>
        )}
        {dayTasks.length > 0 && (
          <div className="section-heading tasks">
            <Icon name="checkCircle" size={14} /> Tasks
          </div>
        )}
        {dayTasks.map((t) => (
          <div className="task-row" key={t.id}>
            <input
              type="checkbox"
              className="checkbox"
              checked={t.status === "Done"}
              onChange={() => toggleDone(t)}
              aria-label={`Mark "${t.name}" ${t.status === "Done" ? "not done" : "done"}`}
            />
            <div className="task-main">
              <span
                className={`task-name task-name-editable ${t.status === "Done" ? "done" : ""}`}
                onClick={() => startEditTask(t)}
                title="Edit task"
              >
                {t.name}
              </span>
              <TaskMeta
                task={t}
                showDue={false}
                goalName={t.category === "Goal-Related" && t.goal_id ? goalName(t.goal_id) : ""}
              />
            </div>
            <button className="ghost icon-btn" onClick={() => startEditTask(t)} aria-label="Edit task" title="Edit">
              <Icon name="edit" size={14} />
            </button>
          </div>
        ))}
        <form className="day-panel-add" onSubmit={(e) => addTaskOnDay(e, dateStr)}>
          <input
            type="text"
            placeholder="Add a task on this day…"
            aria-label="New task name"
            value={dayTaskName}
            onChange={(e) => setDayTaskName(e.target.value)}
            autoFocus={!!selectedDay}
          />
          <button type="submit" className="primary" disabled={!dayTaskName.trim()}>Add</button>
        </form>
        <button type="button" className="ghost small-btn day-panel-event-btn" onClick={() => setEventDialog({ date: dateStr })}>
          <Icon name="plus" size={13} /> Add an event on this day
        </button>
      </div>
    );
  }

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const grid = getMonthGrid(year, month);
  const weekDays = getWeekDays(calendarDate);
  const calendarDayStr = toISODateLocal(calendarDate);
  const calendarLabel =
    calendarMode === "week"
      ? weekLabel(weekDays)
      : calendarMode === "day"
        ? calendarDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
        : calendarDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const today = new Date();
  const todayStr = toISODateLocal(today);
  const tomorrowStr = toISODateLocal(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));

  const tasksByDate = {};
  const undatedTasksRaw = [];
  for (const t of visibleTasks) {
    if (!t.due_date) {
      undatedTasksRaw.push(t);
      continue;
    }
    (tasksByDate[t.due_date] ||= []).push(t);
  }
  // Finished undated tasks live in the list's Completed section, not the side panel.
  const undatedTasks = undatedTasksRaw.filter((t) => t.status !== "Done");
  for (const key of Object.keys(tasksByDate)) {
    tasksByDate[key] = sortDoneLast(tasksByDate[key]);
  }

  const eventsByDate = {};
  for (const ev of sortEvents(events)) {
    (eventsByDate[ev.date] ||= []).push(ev);
  }

  return (
    <div>
      <h1>Plan</h1>
      <p className="page-sub">Your tasks and events, all in one place.</p>

      <form
        className={`quick-add ${quickAddExpanded ? "expanded" : ""} ${addKind === "event" ? "is-event" : ""}`}
        onSubmit={addFromBar}
      >
        <div className="quick-add-row">
          <div className="segmented add-kind" role="group" aria-label="What to add">
            <button
              type="button"
              className={addKind === "task" ? "active" : ""}
              aria-pressed={addKind === "task"}
              onClick={() => setAddKind("task")}
            >
              <Icon name="checkCircle" size={13} /> Task
            </button>
            <button
              type="button"
              className={addKind === "event" ? "active" : ""}
              aria-pressed={addKind === "event"}
              onClick={() => setAddKind("event")}
            >
              <Icon name="clock" size={13} /> Event
            </button>
          </div>
          <input
            className="quick-add-input"
            type="text"
            placeholder={addKind === "event" ? "Add an event…" : "Add a task…"}
            aria-label={addKind === "event" ? "Event name" : "Task name"}
            value={addName}
            onChange={(e) =>
              addKind === "event"
                ? setNewEvent((f) => ({ ...f, title: e.target.value }))
                : setNewTask((f) => ({ ...f, name: e.target.value }))
            }
          />
          <button
            type="button"
            className="ghost quick-add-options-btn"
            aria-expanded={quickAddExpanded}
            onClick={() => setOptionsOpen((o) => !o)}
          >
            {quickAddExpanded ? "Fewer options" : "Options"}
          </button>
          <button type="submit" className={`primary ${addKind === "event" ? "event-primary" : ""}`} disabled={!addName.trim()}>
            Add
          </button>
        </div>
        {quickAddExpanded && (
          <div className="quick-add-options">
            {addKind === "event" ? (
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
                goalOptions={goalOptions()}
                showName={false}
              />
            )}
          </div>
        )}
      </form>

      <div className="row-between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <Popover
            label={
              <>
                Filters
                {activeFilterCount > 0 && <span className="filter-count">{activeFilterCount}</span>}
              </>
            }
            onClear={activeFilterCount > 0 ? clearAllFilters : undefined}
            clearLabel="Clear all filters"
          >
            <div className="filter-panel">
              <div className="filter-panel-row">
                <label>Category</label>
                <Select
                  ariaLabel="Filter by category"
                  value={filterCategory}
                  onChange={setFilterCategory}
                  options={[{ value: "All", label: "All categories" }, "General Life", "Goal-Related"]}
                  onClear={filterCategory !== "All" ? () => setFilterCategory("All") : undefined}
                  clearLabel="Clear category filter"
                />
              </div>
              <div className="filter-panel-row">
                <label>Status</label>
                <Select
                  ariaLabel="Filter by status"
                  value={filterStatus}
                  onChange={setFilterStatus}
                  options={[{ value: "All", label: "All statuses" }, "To Do", "Done"]}
                  onClear={filterStatus !== "All" ? () => setFilterStatus("All") : undefined}
                  clearLabel="Clear status filter"
                />
              </div>
              <div className="filter-panel-row">
                <label>Priority</label>
                <Select
                  ariaLabel="Filter by priority"
                  value={filterPriority}
                  onChange={setFilterPriority}
                  options={[{ value: "All", label: "All priorities" }, "High", "Medium", "Low"]}
                  onClear={filterPriority !== "All" ? () => setFilterPriority("All") : undefined}
                  clearLabel="Clear priority filter"
                />
              </div>
              <div className="filter-panel-row">
                <label>Effort</label>
                <Select
                  ariaLabel="Filter by effort"
                  value={filterEffort}
                  onChange={setFilterEffort}
                  options={[{ value: "All", label: "All effort" }, "Small", "Medium", "Large"]}
                  onClear={filterEffort !== "All" ? () => setFilterEffort("All") : undefined}
                  clearLabel="Clear effort filter"
                />
              </div>
              {activeFilterCount > 0 && (
                <button className="ghost filter-panel-clear" onClick={clearAllFilters}>Clear all filters</button>
              )}
            </div>
          </Popover>

          {view === "list" && (
            <div className="sort-control">
              <span className="sort-label">Sort</span>
              <Select
                ariaLabel="Sort tasks"
                value={sortBy}
                onChange={setSortBy}
                options={[
                  { value: "due", label: "Due date" },
                  { value: "priority", label: "Priority" },
                  { value: "effort", label: "Effort" },
                  { value: "newest", label: "Newest" },
                  { value: "oldest", label: "Oldest" },
                  { value: "custom", label: "Custom (drag to reorder)" },
                ]}
                onClear={sortBy !== "due" ? () => setSortBy("due") : undefined}
                clearLabel="Clear sort"
              />
            </div>
          )}
        </div>

        <div className="row" style={{ gap: 4 }}>
          <button
            className={`ghost view-toggle-btn ${view === "list" ? "active" : ""}`}
            onClick={() => changeView("list")}
            aria-label="List view"
          >
            <Icon name="list" size={15} />
          </button>
          <button
            className={`ghost view-toggle-btn ${view === "calendar" ? "active" : ""}`}
            onClick={() => changeView("calendar")}
            aria-label="Calendar view"
          >
            <Icon name="calendar" size={15} />
          </button>
        </div>
      </div>

      {view === "list" ? (
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
              {activeFilterCount > 0 ? "No scheduled tasks match these filters." : "Nothing scheduled. Give a task a date, or add an event."}
            </p>
          )}
          {agenda.map((day) => {
            const droppable = day.key !== "overdue";
            return (
              <section
                className={`plan-day ${day.key === "overdue" ? "overdue" : ""} ${dragOverDay === day.key ? "drag-over" : ""}`}
                key={day.key}
                {...(droppable ? dropZone(day.key, day.key) : {})}
              >
                <h3 className="plan-day-label">{day.label}</h3>
                {day.events.map((ev) => renderListEvent(ev, false))}
                {day.tasks.map((t) =>
                  renderTaskRow(t, { showDue: day.key === "overdue", plainDue: true })
                )}
              </section>
            );
          })}
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
                        renderTaskRow(t, { doneOn: g.key === "older" && t.completed_at ? localDateOf(t.completed_at) : null })
                      )}
                    </div>
                  ))}
                  <div className="completed-footer">
                    {completedHidden > 0 && (
                      <button
                        type="button"
                        className="ghost small-btn"
                        onClick={() => setCompletedLimit((n) => n + COMPLETED_PAGE)}
                      >
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

        <div
          className={`card task-list-card plan-undated ${dragOverDay === "noDate" ? "drag-over" : ""}`}
          {...dropZone("noDate", null)}
        >
          <h2 className="plan-col-title">
            No date
            {taskGroups.noDate.length > 0 && <span className="task-group-count">{taskGroups.noDate.length}</span>}
          </h2>
          {loading && <Skeleton rows={3} />}
          {!loading && taskGroups.noDate.length === 0 && (
            <p className="plan-empty">Every task has a date.</p>
          )}
          {taskGroups.noDate.map((t) => renderTaskRow(t))}
        </div>
        </div>
      ) : (
        <div className="calendar-wrap">
          <div className="card calendar-main" ref={calendarMainRef}>
            <div className="calendar-header">
              <div className="row" style={{ gap: 4 }}>
                <button
                  className="ghost icon-btn"
                  onClick={() => shiftCalendar(-1)}
                  aria-label={`Previous ${calendarMode}`}
                >
                  ‹
                </button>
                <button
                  className="ghost icon-btn"
                  onClick={() => shiftCalendar(1)}
                  aria-label={`Next ${calendarMode}`}
                >
                  ›
                </button>
                <span className="calendar-title">{calendarLabel}</span>
              </div>
              <div className="row" style={{ gap: 8 }}>
                <button
                  className="ghost new-event-btn"
                  onClick={() => setEventDialog({ date: calendarMode === "day" ? calendarDayStr : toISODateLocal(new Date()) })}
                >
                  <Icon name="plus" size={13} /> Event
                </button>
                <button className="ghost" onClick={() => setCalendarDate(new Date())}>Today</button>
                <div className="segmented" role="group" aria-label="Calendar range">
                  {["month", "week", "day"].map((mode) => (
                    <button
                      key={mode}
                      className={calendarMode === mode ? "active" : ""}
                      aria-pressed={calendarMode === mode}
                      onClick={() => changeCalendarMode(mode)}
                    >
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {calendarMode === "day" ? (
              <div
                className={`calendar-day ${draggedTaskId ? "drop-target" : ""}`}
                onDragOver={(e) => {
                  if (!draggedTaskId) return;
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedTaskId) moveTaskToDate(draggedTaskId, calendarDayStr);
                  setDraggedTaskId(null);
                }}
              >
                {renderDayTasks(calendarDayStr)}
              </div>
            ) : calendarMode === "month" ? (
              <div className="calendar-grid">
                {WEEKDAY_LABELS.map((w) => (
                  <div className="calendar-weekday" key={w}>{w}</div>
                ))}
                {grid.map(({ date, outside }) => {
                  const cellDateStr = toISODateLocal(date);
                  const dayTasks = tasksByDate[cellDateStr] || [];
                  const dayEvents = eventsByDate[cellDateStr] || [];
                  // Events first, then tasks; past the limit, the last slot says "+N more".
                  const items = [
                    ...dayEvents.map((ev) => ({ key: `e${ev.id}`, render: () => renderCalendarEvent(ev) })),
                    ...dayTasks.map((t) => ({ key: `t${t.id}`, render: () => renderCalendarTask(t) })),
                  ];
                  const hidden = items.length - MONTH_CELL_LIMIT;
                  return (
                    <div
                      className={`calendar-cell ${outside ? "outside" : ""} ${isSameDay(date, today) ? "today" : ""} ${draggedTaskId ? "drop-target" : ""}`}
                      key={cellDateStr}
                      onClick={() => openDay(cellDateStr)}
                      onDragOver={(e) => {
                        if (!draggedTaskId) return;
                        e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedTaskId) moveTaskToDate(draggedTaskId, cellDateStr);
                        setDraggedTaskId(null);
                      }}
                    >
                      <button
                        type="button"
                        className="calendar-date"
                        aria-label={`Open ${date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}`}
                      >
                        {date.getDate()}
                      </button>
                      <div className="calendar-cell-tasks">
                        {items.slice(0, hidden > 0 ? MONTH_CELL_LIMIT - 1 : MONTH_CELL_LIMIT).map((item) => item.render())}
                        {hidden > 0 && (
                          <span className="calendar-more">+{hidden + 1} more</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="calendar-week">
                {weekDays.map((date) => {
                  const cellDateStr = toISODateLocal(date);
                  const dayTasks = tasksByDate[cellDateStr] || [];
                  const dayEvents = eventsByDate[cellDateStr] || [];
                  return (
                    <div
                      className={`calendar-week-day ${isSameDay(date, today) ? "today" : ""} ${draggedTaskId ? "drop-target" : ""}`}
                      key={cellDateStr}
                      onDragOver={(e) => {
                        if (!draggedTaskId) return;
                        e.preventDefault();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedTaskId) moveTaskToDate(draggedTaskId, cellDateStr);
                        setDraggedTaskId(null);
                      }}
                    >
                      <button type="button" className="calendar-week-head" onClick={() => openDay(cellDateStr)}>
                        <span className="calendar-week-weekday">{WEEKDAY_LABELS[date.getDay()]}</span>
                        <span className="calendar-week-date">{date.getDate()}</span>
                      </button>
                      <div className="calendar-week-tasks">
                        {dayEvents.map((ev) => (
                          <button
                            type="button"
                            className="calendar-week-event"
                            key={ev.id}
                            onClick={() => setEventDialog({ event: ev })}
                          >
                            <span className="calendar-week-event-time">
                              <Icon name="clock" size={11} /> {eventTimeLabel(ev)}
                            </span>
                            <span className="calendar-week-event-title">{ev.title}</span>
                            {ev.location && <span className="calendar-week-event-location">{ev.location}</span>}
                          </button>
                        ))}
                        {dayTasks.map((t) => (
                          <div
                            className={`calendar-week-task ${t.status === "Done" ? "done" : ""}`}
                            key={t.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = "move";
                              setDraggedTaskId(t.id);
                            }}
                            onDragEnd={() => setDraggedTaskId(null)}
                          >
                            <input
                              type="checkbox"
                              className="checkbox"
                              checked={t.status === "Done"}
                              onChange={() => toggleDone(t)}
                              aria-label={`Mark "${t.name}" ${t.status === "Done" ? "not done" : "done"}`}
                            />
                            <div className="task-main">
                              <span
                                className={`task-name task-name-editable ${t.status === "Done" ? "done" : ""}`}
                                onClick={() => startEditTask(t)}
                              >
                                {t.name}
                              </span>
                              <TaskMeta task={t} compact showDue={false} />
                            </div>
                          </div>
                        ))}
                        <button type="button" className="calendar-week-add" onClick={() => openDay(cellDateStr)}>
                          <Icon name="plus" size={13} /> Add
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="calendar-legend" aria-hidden="true">
              <span className="calendar-legend-item events">
                <span className="calendar-legend-swatch" /> Events
              </span>
              <span className="calendar-legend-item tasks">
                <span className="calendar-legend-check" /> Tasks
              </span>
            </div>
          </div>

          <div
            className="card calendar-side"
            style={calendarSideMaxHeight ? { height: calendarSideMaxHeight } : undefined}
          >
            <div className="calendar-side-section">
              <div className="section-label">Scheduled</div>
              <div className="calendar-side-list">
                {loading && <Skeleton rows={2} />}
                {!loading && agenda.length === 0 && (
                  <div className="empty-state-mini">
                    <span className="empty-state-icon">✅</span>
                    <span>Nothing coming up.</span>
                  </div>
                )}
                {agenda.map((day) => (
                  <div className={`agenda-day ${day.key === "overdue" ? "overdue" : ""}`} key={day.key}>
                    <div className="agenda-day-label">{day.label}</div>
                    {day.events.map(renderAgendaEvent)}
                    {day.tasks.map((t) => renderUpcomingTaskRow(t, day.key === "overdue"))}
                  </div>
                ))}
              </div>
            </div>

            <div className="calendar-side-section">
              <div className="section-label">No date</div>
              <div
                className={`calendar-side-list ${draggedTaskId ? "drop-target" : ""}`}
                onDragOver={(e) => {
                  if (!draggedTaskId) return;
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedTaskId) moveTaskToDate(draggedTaskId, null);
                  setDraggedTaskId(null);
                }}
              >
                {loading && <Skeleton rows={2} />}
                {!loading && undatedTasks.length === 0 && (
                  <div className="empty-state-mini">
                    <span className="empty-state-icon">📭</span>
                    <span>Nothing here.</span>
                  </div>
                )}
                {undatedTasks.map((t) => renderUndatedTaskRow(t))}
              </div>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={view === "calendar" && !!selectedDay && !editingTask && !eventDialog}
        onClose={() => setSelectedDay(null)}
        title={
          selectedDay
            ? parseLocalDate(selectedDay).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
            : ""
        }
      >
        {selectedDay && renderDayTasks(selectedDay)}
      </Modal>

      <TaskEditModal
        task={editingTask}
        tasks={tasks}
        goals={goals}
        onClose={() => setEditingTask(null)}
        onSaved={loadData}
      />
      <EventModal
        open={!!eventDialog}
        event={eventDialog?.event}
        defaultDate={eventDialog?.date}
        onClose={() => setEventDialog(null)}
        onSaved={loadData}
      />
    </div>
  );
}
